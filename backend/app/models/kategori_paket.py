from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class KategoriPaket(Base):
    __tablename__ = "kategori_paket"
    __table_args__ = (
        CheckConstraint("tipe IN ('ujian', 'latihan', 'keduanya')", name="ck_kategori_paket_tipe"),
    )

    id = Column(Integer, primary_key=True, index=True)
    kode = Column(String(50), nullable=False, unique=True, index=True)
    nama = Column(String(100), nullable=False, unique=True, index=True)
    deskripsi = Column(Text, nullable=True)
    tipe = Column(String(20), nullable=False, default="keduanya", server_default="keduanya")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    paket = relationship("PaketUjian", back_populates="kategori_ref")
