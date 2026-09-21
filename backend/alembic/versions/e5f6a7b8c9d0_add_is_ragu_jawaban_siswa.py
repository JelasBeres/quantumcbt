"""add is_ragu to jawaban_siswa

Revision ID: e5f6a7b8c9d0
Revises: b1c2d3e4f5a6
Create Date: 2026-09-06 00:00:00.000000

- jawaban_siswa.is_ragu: penanda siswa ragu-ragu pada suatu soal saat mengerjakan
  ujian. Digunakan untuk navigasi di ruang ujian dan dapat dilihat admin (rekap).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jawaban_siswa", sa.Column("is_ragu", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("jawaban_siswa", "is_ragu")
