from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.schemas.auth import Login, Register, Token, RefreshToken, ChangePassword, ResetPassword, Logout
from app.schemas.user import UserOut
from app.db.database import get_db
from app.models.user import User
from app.models.auth_session import AuthSession
from app.models.login_attempt import LoginAttempt
from app.models.login_activity import LoginActivity
from app.core.timeutils import ensure_utc
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token_payload,
    get_current_active_user,
    client_ip,
    oauth2_scheme,
)

router = APIRouter(prefix="/auth", tags=["auth"])
LOGIN_LIMIT = 10
LOGIN_WINDOW = timedelta(minutes=5)


def _issue_tokens(db: Session, user: User, family_id: str | None = None) -> tuple[str, str, AuthSession]:
    now = datetime.now(timezone.utc)
    family = family_id or str(uuid4())
    refresh_jti = str(uuid4())
    token_data = {"sub": user.username, "uid": user.id, "ver": int(user.token_version or 0)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token({**token_data, "jti": refresh_jti, "family": family})
    session = AuthSession(
        user_id=user.id,
        jti_hash=AuthSession.hash_jti(refresh_jti),
        family_id=family,
        expires_at=now + timedelta(days=7),
    )
    db.add(session)
    return access_token, refresh_token, session


def _revoke_user_sessions(db: Session, user: User) -> None:
    user.token_version = int(user.token_version or 0) + 1
    db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)).update(
        {AuthSession.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False
    )


def _check_login_limit(db: Session, ip: str, username: str) -> LoginAttempt:
    now = datetime.now(timezone.utc)
    record = (
        db.query(LoginAttempt)
        .filter(LoginAttempt.ip_address == ip, LoginAttempt.username == username)
        .with_for_update()
        .first()
    )
    if not record:
        record = LoginAttempt(ip_address=ip, username=username, attempts=0, window_started_at=now)
        db.add(record)
        db.flush()
    blocked_until = ensure_utc(record.blocked_until)
    if blocked_until and blocked_until > now:
        retry_after = max(1, int((blocked_until - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    if now - ensure_utc(record.window_started_at) >= LOGIN_WINDOW:
        record.attempts = 0
        record.window_started_at = now
        record.blocked_until = None
    return record


@router.post("/register", response_model=UserOut)
def register(payload: Register, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can create new accounts")
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    user = User(username=payload.username, password_hash=get_password_hash(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: Login, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    normalized_username = payload.username.strip()
    attempt = _check_login_limit(db, ip, normalized_username.lower())
    user = db.query(User).filter(User.username == normalized_username).first()
    successful = bool(user and user.is_active and verify_password(payload.password, user.password_hash))

    db.add(LoginActivity(
        user_id=user.id if user else None,
        username=normalized_username,
        ip_address=ip,
        successful=successful,
    ))

    if not successful:
        attempt.attempts += 1
        if attempt.attempts >= LOGIN_LIMIT:
            attempt.blocked_until = datetime.now(timezone.utc) + LOGIN_WINDOW
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    db.delete(attempt)
    access_token, refresh_token, _ = _issue_tokens(db, user)
    db.commit()
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/refresh-token", response_model=Token)
def refresh_token(payload: RefreshToken, db: Session = Depends(get_db)):
    claims = decode_token_payload(payload.refresh_token, "refresh")
    jti = claims.get("jti")
    family_id = claims.get("family")
    user_id = claims.get("uid")
    if not jti or not family_id or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session = (
        db.query(AuthSession)
        .filter(AuthSession.jti_hash == AuthSession.hash_jti(jti))
        .with_for_update()
        .first()
    )
    now = datetime.now(timezone.utc)
    if not session or session.revoked_at or ensure_utc(session.expires_at) <= now:
        if session:
            db.query(AuthSession).filter(AuthSession.family_id == session.family_id).update(
                {AuthSession.revoked_at: now}, synchronize_session=False
            )
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user or int(claims.get("ver", -1)) != int(user.token_version or 0):
        session.revoked_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session.revoked_at = now
    access_token, new_refresh_token, new_session = _issue_tokens(db, user, family_id=family_id)
    db.flush()
    session.replaced_by_hash = new_session.jti_hash
    db.commit()
    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}


@router.post("/change-password")
def change_password(payload: ChangePassword, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = get_password_hash(payload.new_password)
    _revoke_user_sessions(db, current_user)
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/reset-password")
def reset_password(payload: ResetPassword, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can reset passwords")
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.password_hash = get_password_hash(payload.new_password)
    _revoke_user_sessions(db, user)
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/logout")
def logout(
    payload: Logout,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Invalidate issued access tokens as well as refresh sessions. Clearing the
    # browser alone would leave a copied access token valid until it expires.
    _revoke_user_sessions(db, current_user)
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_active_user)):
    return current_user
