"""add pembahasan to soal and opsi_jawaban, create laporan_soal

Revision ID: d4e5f6a7b8c1
Revises: c3d4e5f6a7b9
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c1"
down_revision: Union[str, None] = "c3d4e5f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("soal", sa.Column("pembahasan", sa.Text(), nullable=True))
    op.add_column("opsi_jawaban", sa.Column("pembahasan", sa.Text(), nullable=True))
    op.create_table(
        "laporan_soal",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("soal_id", sa.Integer(), sa.ForeignKey("soal.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("alasan", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), server_default="baru", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_laporan_soal_id", "laporan_soal", ["id"])


def downgrade() -> None:
    op.drop_index("ix_laporan_soal_id", table_name="laporan_soal")
    op.drop_table("laporan_soal")
    op.drop_column("opsi_jawaban", "pembahasan")
    op.drop_column("soal", "pembahasan")
