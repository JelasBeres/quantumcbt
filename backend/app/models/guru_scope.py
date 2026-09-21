from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint, func

from app.models.base import Base


class GuruScope(Base):
    __tablename__ = "guru_scope"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "pelajaran_id",
            "program_id",
            "kelas_id",
            name="uq_guru_scope_assignment",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pelajaran_id = Column(Integer, ForeignKey("pelajaran.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), nullable=True, index=True)
    kelas_id = Column(Integer, ForeignKey("kelas.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
