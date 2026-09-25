from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from app.models.base import Base


class PaketMapel(Base):
    """Mapel yang ditambahkan ke paket latihan. Mapel boleh belum punya set soal;
    set soal (bagian_paket) ditambahkan kemudian di halaman mapel tersebut."""

    __tablename__ = "paket_mapel"
    __table_args__ = (
        UniqueConstraint("paket_ujian_id", "pelajaran_id", name="uq_paket_mapel_paket_pelajaran"),
    )

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    pelajaran_id = Column(Integer, nullable=False, index=True)
    urutan = Column(Integer, nullable=False, default=0)
