from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func, text

from app.models.base import Base


class GrupTryout(Base):
    __tablename__ = "grup_tryout"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(200), nullable=False, unique=True)
    deskripsi = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default=text("true"), default=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
