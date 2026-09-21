from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from app.models.base import Base


class OpsiJawaban(Base):
    __tablename__ = "opsi_jawaban"

    id = Column(Integer, primary_key=True, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    teks_opsi = Column(Text, nullable=False)
    is_benar = Column(Boolean, default=False)
    urutan = Column(Integer, default=0)
