from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, func
from app.core.timeutils import utc_now
from app.models.base import Base


class Subbab(Base):
    __tablename__ = "subbab"

    id = Column(Integer, primary_key=True, index=True)
    topik_id = Column(Integer, ForeignKey("topik.id", ondelete="RESTRICT"), nullable=False, index=True)
    nama = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, server_default=func.now(), onupdate=utc_now)
    __table_args__ = (Index("uq_subbab_topik_nama_lower", topik_id, func.lower(nama), unique=True),)
