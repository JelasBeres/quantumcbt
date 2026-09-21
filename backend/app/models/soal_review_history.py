from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.models.base import Base


class SoalReviewHistory(Base):
    __tablename__ = "soal_review_history"

    id = Column(Integer, primary_key=True, index=True)
    soal_id = Column(Integer, ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(40), nullable=False, index=True)
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
