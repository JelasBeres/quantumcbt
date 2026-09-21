from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, func

from app.models.base import Base


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (UniqueConstraint("ip_address", "username", name="uq_login_attempt_ip_username"),)

    id = Column(Integer, primary_key=True)
    ip_address = Column(String(100), nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)
    attempts = Column(Integer, nullable=False, default=0)
    window_started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    blocked_until = Column(DateTime(timezone=True), nullable=True, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
