from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from app.models.base import Base


class LoginActivity(Base):
    __tablename__ = "login_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL", name="fk_login_activity_user_id"), nullable=True, index=True)
    username = Column(String(100), nullable=False)
    ip_address = Column(String(100), nullable=True)
    successful = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
