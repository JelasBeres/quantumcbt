from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from app.models.base import Base


class BagianPaket(Base):
    __tablename__ = "bagian_paket"

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    nama = Column(String(200), nullable=False)
    urutan = Column(Integer, nullable=False, default=0)
    durasi_menit = Column(Integer, nullable=True)
    pelajaran_id = Column(Integer, nullable=True, index=True)
    is_random_soal = Column(Boolean, nullable=True, default=True)
    is_random_opsi = Column(Boolean, nullable=True, default=True)
    deskripsi = Column(Text, nullable=True)
