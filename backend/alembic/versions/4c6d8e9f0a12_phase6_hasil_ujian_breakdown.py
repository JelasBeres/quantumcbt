"""phase6 hasil ujian breakdown

Revision ID: 4c6d8e9f0a12
Revises: 2f5c8d1e7a92
Create Date: 2026-07-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c6d8e9f0a12"
down_revision: Union[str, None] = "2f5c8d1e7a92"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hasil_ujian", sa.Column("skor_per_pelajaran_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("hasil_ujian", "skor_per_pelajaran_json")
