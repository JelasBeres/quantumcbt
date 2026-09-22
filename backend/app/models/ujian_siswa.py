from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Index, JSON, UniqueConstraint, func
from sqlalchemy.sql import func
from app.models.base import Base


class UjianSiswa(Base):
    __tablename__ = "ujian_siswa"
    __table_args__ = (
        Index("idx_ujian_siswa_active", "siswa_id", "jadwal_ujian_id", "is_submitted"),
        UniqueConstraint("siswa_id", "jadwal_ujian_id", name="uq_ujian_siswa_siswa_jadwal"),
    )

    id = Column(Integer, primary_key=True, index=True)
    siswa_id = Column(Integer, ForeignKey("siswa.id", ondelete="CASCADE"), nullable=False, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    jadwal_ujian_id = Column(Integer, ForeignKey("jadwal_ujian.id", ondelete="SET NULL"), nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    is_submitted = Column(Boolean, default=False, index=True)
    soal_urutan = Column(JSON, nullable=True)
    opsi_urutan = Column(JSON, nullable=True)
    bagian_urutan = Column(JSON, nullable=True)
    mode_latihan = Column(String(20), nullable=True)
    bagian_aktif = Column(Integer, nullable=False, default=0, server_default="0")
    bagian_mulai_at = Column(DateTime(timezone=True), nullable=True)
    latihan_bagian_id = Column(Integer, nullable=True)
