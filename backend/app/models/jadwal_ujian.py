from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Index, String, Text, text
from app.models.base import Base


class JadwalUjian(Base):
    __tablename__ = "jadwal_ujian"
    __table_args__ = (
        Index("ix_jadwal_ujian_published_deleted", "is_published", "is_deleted"),
    )

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    mulai = Column(DateTime(timezone=True), nullable=False)
    selesai = Column(DateTime(timezone=True), nullable=True)
    is_published = Column(Boolean, nullable=True, server_default=text('false'), default=False)
    program_id = Column(Integer, nullable=True, index=True)
    kelas_id = Column(Integer, nullable=True, index=True)
    is_deleted = Column(Boolean, nullable=True, server_default=text('false'), default=False)
    durasi_menit_paket = Column(Integer, nullable=True)
    status = Column(String(30), nullable=False, server_default="draft", default="draft", index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    submitted_for_review_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    deletion_reason = Column(Text, nullable=True)
