from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class LaporanSoal(Base):
    __tablename__ = "laporan_soal"

    id = Column(Integer, primary_key=True, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    alasan = Column(Text, nullable=True)
    status = Column(String(50), default="baru", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    soal = relationship("Soal")
    user = relationship("User")
