from sqlalchemy import Column, Integer, String
from app.models.base import Base


class Kelas(Base):
    __tablename__ = "kelas"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(100), nullable=False)
