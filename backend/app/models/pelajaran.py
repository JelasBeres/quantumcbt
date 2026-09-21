from sqlalchemy import Boolean, Column, Integer, String, ForeignKey
from app.models.base import Base


class Pelajaran(Base):
    __tablename__ = "pelajaran"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(150), nullable=False)
    program_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
