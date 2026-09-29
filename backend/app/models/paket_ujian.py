from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class PaketUjian(Base):
    __tablename__ = "paket_ujian"
    __table_args__ = (
        CheckConstraint("metode_penilaian IN ('biasa', 'kohort')", name="ck_paket_ujian_metode_penilaian"),
        CheckConstraint("skala_kohort IN ('utbk', 'tka')", name="ck_paket_ujian_skala_kohort"),
    )

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(200), nullable=False)
    deskripsi = Column(Text, nullable=True)
    durasi_menit = Column(Integer, default=60, nullable=False)
    jumlah_soal = Column(Integer, default=0, nullable=False)
    is_random_soal = Column(Boolean, default=True)
    is_random_opsi = Column(Boolean, default=True)
    pelajaran_id = Column(Integer, nullable=True, index=True)
    kelas_id = Column(Integer, nullable=True)
    program_id = Column(Integer, nullable=True, index=True)
    tipe = Column(String(20), default="ujian", nullable=False, server_default="ujian")
    kategori = Column(String(20), nullable=True, index=True)
    kategori_id = Column(Integer, ForeignKey("kategori_paket.id", ondelete="RESTRICT"), nullable=True, index=True)
    metode_penilaian = Column(String(20), nullable=False, default="biasa", server_default="biasa")
    skala_kohort = Column(String(20), nullable=False, default="utbk", server_default="utbk")
    izinkan_pilih_mapel = Column(Boolean, nullable=False, default=True, server_default="true")
    # Nilai minimal lulus (0-100); hanya dipakai untuk metode penilaian biasa.
    kkm = Column(Float, nullable=False, default=75, server_default="75")
    kategori_ref = relationship("KategoriPaket", back_populates="paket")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_archived = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    assigned_guru_ids = Column(JSON, nullable=True)
