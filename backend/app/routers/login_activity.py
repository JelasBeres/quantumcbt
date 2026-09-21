from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.database import get_db
from app.models.login_activity import LoginActivity
from app.schemas.login_activity import LoginActivityOut

router = APIRouter(prefix="/login-activity", tags=["login_activity"])


@router.get("/", response_model=List[LoginActivityOut])
def list_login_activity(
    username: Optional[str] = None,
    successful: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(LoginActivity)
    if username is not None:
        query = query.filter(LoginActivity.username == username)
    if successful is not None:
        query = query.filter(LoginActivity.successful == successful)
    return query.order_by(LoginActivity.created_at.desc()).all()
