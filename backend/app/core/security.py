from datetime import datetime, timedelta, timezone
from typing import Callable, Iterable, Optional
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.models.guru_scope import GuruScope
from app.models.paket_ujian import PaketUjian
from app.models.bagian_paket import BagianPaket
from app.schemas.auth import TokenData

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_token(data: dict, expires_delta: Optional[timedelta] = None, token_type: str = "access") -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=int(settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": now, "jti": to_encode.get("jti") or str(uuid4()), "type": token_type})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    return encoded_jwt


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return create_token(data, expires_delta, token_type="access")


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta is None:
        expires_delta = timedelta(days=7)
    return create_token(data, expires_delta, token_type="refresh")


def decode_token_payload(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        if username is None or token_type != expected_type or not payload.get("jti"):
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def decode_token(token: str, expected_type: str) -> str:
    payload = decode_token_payload(token, expected_type)
    return TokenData(username=payload["sub"]).username


def decode_access_token(token: str) -> str:
    return decode_token(token, "access")


def decode_refresh_token(token: str) -> str:
    return decode_token(token, "refresh")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token_payload(token, "access")
    username = payload["sub"]
    user = db.query(User).filter(User.username == username).first()
    if user is None or int(payload.get("ver", -1)) != int(user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(token: str = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_token_payload(token, "access")
    username = payload["sub"]
    user = db.query(User).filter(User.username == username).first()
    if user is None or int(payload.get("ver", -1)) != int(user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


def require_roles(required_roles: list[str]) -> Callable:
    def role_dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency


def require_role(required_role: str) -> Callable:
    return require_roles([required_role])


def guru_scope_audience_filter(
    user: User,
    pelajaran_id,
    program_id,
    kelas_id,
):
    return exists().where(
        GuruScope.user_id == user.id,
        GuruScope.pelajaran_id == pelajaran_id,
        or_(GuruScope.program_id.is_(None), GuruScope.program_id == program_id),
        or_(GuruScope.kelas_id.is_(None), GuruScope.kelas_id == kelas_id),
    )


def guru_scope_question_report_filter(user: User, pelajaran_id, kelas_id):
    return exists().where(
        GuruScope.user_id == user.id,
        GuruScope.pelajaran_id == pelajaran_id,
        or_(kelas_id.is_(None), GuruScope.kelas_id.is_(None), GuruScope.kelas_id == kelas_id),
    )


def guru_can_access_question_report(db: Session, user: User, pelajaran_id: Optional[int], kelas_id: Optional[int]) -> bool:
    if user.role == "admin":
        return True
    if user.role != "guru" or not user.is_active or pelajaran_id is None:
        return False
    query = db.query(GuruScope.id).filter(
        GuruScope.user_id == user.id,
        GuruScope.pelajaran_id == pelajaran_id,
    )
    if kelas_id is not None:
        query = query.filter(or_(GuruScope.kelas_id.is_(None), GuruScope.kelas_id == kelas_id))
    return query.first() is not None


def guru_has_scope(
    db: Session,
    user: User,
    pelajaran_id: int,
    program_id: Optional[int] = None,
    kelas_id: Optional[int] = None,
) -> bool:
    """Check academic assignment. Admin bypasses; guru must match one assignment.

    A NULL program/kelas in a scope acts as a wildcard for that dimension.
    """
    if user.role == "admin":
        return True
    if user.role != "guru" or not user.is_active:
        return False
    scopes = db.query(GuruScope).filter(
        GuruScope.user_id == user.id,
        GuruScope.pelajaran_id == pelajaran_id,
    ).all()
    return any(
        (scope.program_id is None or scope.program_id == program_id)
        and (scope.kelas_id is None or scope.kelas_id == kelas_id)
        for scope in scopes
    )


def guru_can_access_section(db: Session, user: User, section: BagianPaket, paket: PaketUjian | None = None) -> bool:
    if user.role == "admin":
        return True
    if user.role != "guru" or section.pelajaran_id is None:
        return False
    paket = paket or db.query(PaketUjian).filter(PaketUjian.id == section.paket_ujian_id).first()
    if not paket:
        return False
    return guru_has_scope(db, user, section.pelajaran_id, paket.program_id, paket.kelas_id)


def guru_can_access_package(db: Session, user: User, paket: PaketUjian) -> bool:
    if user.role == "admin":
        return True
    if user.role != "guru" or not user.is_active:
        return False
    sections = db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == paket.id).all()
    if sections:
        return any(guru_can_access_section(db, user, section, paket) for section in sections)
    return paket.pelajaran_id is not None and guru_has_scope(db, user, paket.pelajaran_id, paket.program_id, paket.kelas_id)


def guru_accessible_package_ids(db: Session, user: User, package_ids: Iterable[int]) -> set[int]:
    ids = set(package_ids)
    if user.role == "admin":
        return ids
    if user.role != "guru" or not user.is_active or not ids:
        return set()
    scopes = db.query(GuruScope).filter(GuruScope.user_id == user.id).all()
    if not scopes:
        return set()
    packages = db.query(PaketUjian.id, PaketUjian.pelajaran_id, PaketUjian.program_id, PaketUjian.kelas_id).filter(PaketUjian.id.in_(ids)).all()
    section_rows = db.query(BagianPaket.paket_ujian_id, BagianPaket.pelajaran_id).filter(BagianPaket.paket_ujian_id.in_(ids)).all()
    sections_by_package: dict[int, list[int | None]] = {}
    for package_id, pelajaran_id in section_rows:
        sections_by_package.setdefault(package_id, []).append(pelajaran_id)
    visible = set()
    for package_id, pelajaran_id, program_id, kelas_id in packages:
        subjects = sections_by_package.get(package_id) or [pelajaran_id]
        if any(
            subject_id is not None
            and any(
                scope.pelajaran_id == subject_id
                and (scope.program_id is None or scope.program_id == program_id)
                and (scope.kelas_id is None or scope.kelas_id == kelas_id)
                for scope in scopes
            )
            for subject_id in subjects
        ):
            visible.add(package_id)
    return visible


def require_guru_package_access(db: Session, user: User, paket: PaketUjian) -> None:
    if not guru_can_access_package(db, user, paket):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Paket berada di luar penugasan guru")


def require_guru_scope(
    db: Session,
    user: User,
    pelajaran_id: int,
    program_id: Optional[int] = None,
    kelas_id: Optional[int] = None,
) -> None:
    if not guru_has_scope(db, user, pelajaran_id, program_id, kelas_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pelajaran, program, atau kelas berada di luar penugasan guru",
        )


def client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    # ProxyHeadersMiddleware sets request.client to (None, 0) when every
    # hop in X-Forwarded-For is itself a trusted proxy (e.g. local
    # frontend -> local backend, or local frontend -> ngrok agent -> local
    # backend). Fall back to the raw header so we never write a NULL IP.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return "unknown"
