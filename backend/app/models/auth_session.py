import hashlib

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.models.base import Base


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti_hash = Column(String(64), unique=True, nullable=False, index=True)
    family_id = Column(String(36), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)
    replaced_by_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @staticmethod
    def hash_jti(jti: str) -> str:
        return hashlib.sha256(jti.encode("utf-8")).hexdigest()
