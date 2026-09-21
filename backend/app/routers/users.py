from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserStatusUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}/status", response_model=UserOut)
def update_user_status(user_id: int, payload: UserStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["admin"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan akun sendiri")
    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
