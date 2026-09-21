from sqlalchemy import Boolean, Column, Float, Integer, ForeignKey, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class JawabanSiswa(Base):
    __tablename__ = "jawaban_siswa"
    __table_args__ = (UniqueConstraint("ujian_siswa_id", "soal_id", name="uq_jawaban_siswa_ujian_soal"),)

    id = Column(Integer, primary_key=True, index=True)
    ujian_siswa_id = Column(Integer, ForeignKey("ujian_siswa.id", ondelete="CASCADE"), nullable=False, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    jawaban = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    # Penanda siswa ragu-ragu terhadap jawaban soal ini.
    is_ragu = Column(Boolean, nullable=False, default=False, server_default="0")
    # Untuk soal esai/isian: jawaban teks bebas dinilai manual oleh guru/admin.
    skor_manual = Column(Float, nullable=True)
    dinilai_oleh = Column(Integer, nullable=True)
    dinilai_at = Column(DateTime(timezone=True), nullable=True)
