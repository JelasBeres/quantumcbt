from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base


class LogKecurangan(Base):
    __tablename__ = "log_kecurangan"

    id = Column(Integer, primary_key=True, index=True)
    ujian_siswa_id = Column(Integer, ForeignKey("ujian_siswa.id", ondelete="CASCADE"), nullable=False)
    tipe_kecurangan = Column(Text, nullable=True)
    deskripsi = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
