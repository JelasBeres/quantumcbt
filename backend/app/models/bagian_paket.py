from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.models.base import Base


class BagianPaket(Base):
    __tablename__ = "bagian_paket"

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False, index=True)
    nama = Column(String(200), nullable=False)
    urutan = Column(Integer, nullable=False, default=0)
    wajib = Column(Boolean, nullable=False, default=True, server_default="true")
    durasi_menit = Column(Integer, nullable=True)
    pelajaran_id = Column(Integer, nullable=True, index=True)
    is_random_soal = Column(Boolean, nullable=True, default=True)
    is_random_opsi = Column(Boolean, nullable=True, default=True)
    deskripsi = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    review_note = Column(Text, nullable=True)
    submitted_for_review_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    revision_number = Column(Integer, nullable=False, default=0, server_default="0")
