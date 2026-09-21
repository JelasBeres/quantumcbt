from sqlalchemy import Boolean, Column, ForeignKey, Integer, Text, UniqueConstraint, false

from app.models.base import Base


class PernyataanBenarSalah(Base):
    __tablename__ = "pernyataan_benar_salah"
    __table_args__ = (UniqueConstraint("soal_id", "urutan", name="uq_pernyataan_benar_salah_soal_urutan"),)

    id = Column(Integer, primary_key=True, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    teks_pernyataan = Column(Text, nullable=False)
    urutan = Column(Integer, nullable=False)
    is_benar = Column(Boolean, nullable=False, default=False, server_default=false())
