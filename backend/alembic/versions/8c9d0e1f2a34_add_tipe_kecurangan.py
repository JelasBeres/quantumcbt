"""add tipe kecurangan

Revision ID: 8c9d0e1f2a34
Revises: 7b8c9d0e1f23
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c9d0e1f2a34"
down_revision: Union[str, None] = "7b8c9d0e1f23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("log_kecurangan", sa.Column("tipe_kecurangan", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("log_kecurangan", "tipe_kecurangan")
