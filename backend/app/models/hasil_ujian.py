from sqlalchemy import Column, Integer, Float, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class HasilUjian(Base):
    __tablename__ = "hasil_ujian"
    __table_args__ = (UniqueConstraint("ujian_siswa_id", name="uq_hasil_ujian_ujian_siswa_id"),)

    id = Column(Integer, primary_key=True, index=True)
    ujian_siswa_id = Column(Integer, ForeignKey("ujian_siswa.id", ondelete="CASCADE"), nullable=False)
    skor = Column(Float, nullable=True)
    skor_per_pelajaran_json = Column(JSON, nullable=True)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())
