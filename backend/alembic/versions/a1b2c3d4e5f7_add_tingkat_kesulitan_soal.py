"""add tingkat kesulitan to soal

Revision ID: a1b2c3d4e5f7
Revises: 7b8c9d0e1f23
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "soal",
        sa.Column("tingkat_kesulitan", sa.Integer(), nullable=True, server_default="50"),
    )


def downgrade() -> None:
    op.drop_column("soal", "tingkat_kesulitan")
