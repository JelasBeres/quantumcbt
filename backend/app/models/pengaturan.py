from sqlalchemy import Column, Integer, String, Text
from app.models.base import Base


class Pengaturan(Base):
    __tablename__ = "pengaturan"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(200), nullable=False, unique=True)
    value = Column(Text, nullable=True)
