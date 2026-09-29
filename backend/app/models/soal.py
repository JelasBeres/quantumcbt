from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String, Text, ForeignKey, func
from app.models.base import Base


class Soal(Base):
    __tablename__ = "soal"
    __table_args__ = (CheckConstraint("poin > 0", name="ck_soal_poin_positive"),)

    id = Column(Integer, primary_key=True, index=True)
    paket_ujian_id = Column(Integer, nullable=True, index=True)
    pelajaran_id = Column(Integer, nullable=True, index=True)
    kelas_id = Column(Integer, nullable=True, index=True)
    topik_id = Column(Integer, nullable=True, index=True)
    subbab_id = Column(Integer, ForeignKey("subbab.id", ondelete="RESTRICT"), nullable=True, index=True)
    subbab = Column(String(150), nullable=True, index=True)
    teks_soal = Column(Text, nullable=False)
    tipe = Column(String(50), default="pilihan_ganda")
    gambar_url = Column(String(500), nullable=True)
    tingkat_kesulitan = Column(String(20), nullable=False, server_default="sedang", default="sedang")
    poin = Column(Float, nullable=False, default=2.0, server_default="1")
    kunci_jawaban = Column(Text, nullable=True)
    label_benar = Column(String(100), nullable=True, default="Benar", server_default="Benar")
    label_salah = Column(String(100), nullable=True, default="Salah", server_default="Salah")
    pembahasan = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    submitted_for_review_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    parent_soal_id = Column(Integer, ForeignKey("soal.id", ondelete="SET NULL"), nullable=True, index=True)
    version = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
