from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from app.models.base import Base


class PaketSoal(Base):
    __tablename__ = "paket_soal"
    __table_args__ = (
        UniqueConstraint("paket_ujian_id", "soal_id", name="uq_paket_soal_paket_soal"),
    )

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    urutan = Column(Integer, nullable=False, default=0)
    bagian_paket_id = Column(Integer, ForeignKey("bagian_paket.id", ondelete="CASCADE"), nullable=True, index=True)
