from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text

from app.models.base import Base


class Pemberitahuan(Base):
    """Pemberitahuan untuk siswa: promo, info, atau paket ujian baru.

    program_id/kelas_id kosong berarti untuk semua siswa. Pemberitahuan
    otomatis dari jadwal yang dipublikasikan menyimpan jadwal_ujian_id agar
    tidak dibuat dua kali saat jadwal dipublikasikan ulang."""

    __tablename__ = "pemberitahuan"

    id = Column(Integer, primary_key=True, index=True)
    judul = Column(String(200), nullable=False)
    isi = Column(Text, nullable=True)
    jenis = Column(String(30), nullable=False, default="info", server_default="info")
    tautan = Column(String(500), nullable=True)
    program_id = Column(Integer, ForeignKey("program.id", ondelete="SET NULL"), nullable=True, index=True)
    kelas_id = Column(Integer, ForeignKey("kelas.id", ondelete="SET NULL"), nullable=True, index=True)
    tampil_popup = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    berlaku_sampai = Column(DateTime(timezone=True), nullable=True)
    jadwal_ujian_id = Column(Integer, ForeignKey("jadwal_ujian.id", ondelete="CASCADE"), nullable=True, unique=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class PemberitahuanDibaca(Base):
    __tablename__ = "pemberitahuan_dibaca"
    __table_args__ = (UniqueConstraint("pemberitahuan_id", "user_id", name="uq_pemberitahuan_dibaca"),)

    id = Column(Integer, primary_key=True, index=True)
    pemberitahuan_id = Column(Integer, ForeignKey("pemberitahuan.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dibaca_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
