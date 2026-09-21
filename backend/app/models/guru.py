from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Guru(Base):
    __tablename__ = "guru"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    nama_lengkap = Column(String(200), nullable=False)
    nip = Column(String(100), nullable=True, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    no_hp = Column(String(30), nullable=True, unique=True, index=True)

    user = relationship("User")
