"""add soal gambar url

Revision ID: 7b8c9d0e1f23
Revises: 4c6d8e9f0a12
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7b8c9d0e1f23"
down_revision: Union[str, None] = "4c6d8e9f0a12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("soal", sa.Column("gambar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("soal", "gambar_url")
