from sqlalchemy import Column, Integer, String, Text, Boolean
from app.models.base import Base


class Program(Base):
    __tablename__ = "program"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(100), nullable=False)
    deskripsi = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
