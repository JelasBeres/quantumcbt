from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, func
from app.models.base import Base


class Topik(Base):
    __tablename__ = "topik"

    id = Column(Integer, primary_key=True, index=True)
    pelajaran_id = Column(Integer, ForeignKey("pelajaran.id", ondelete="RESTRICT"), nullable=False, index=True)
    nama = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    __table_args__ = (Index("uq_topik_pelajaran_nama_lower", pelajaran_id, func.lower(nama), unique=True),)
