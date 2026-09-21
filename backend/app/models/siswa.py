from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


class Siswa(Base):
    __tablename__ = "siswa"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nama_lengkap = Column(String(200), nullable=False)
    sekolah = Column(String(200), nullable=True)
    pilihan_jurusan = Column(JSON, nullable=True)
    no_induk = Column(String(50), unique=True, nullable=True)
    program_id = Column(Integer, nullable=True)
    kelas_id = Column(Integer, nullable=True)

    user = relationship("User")
