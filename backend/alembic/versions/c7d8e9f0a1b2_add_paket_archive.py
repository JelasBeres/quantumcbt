"""add safe package archive fields

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-09-14 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b6c7d8e9f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("paket_ujian", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("paket_ujian", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_paket_ujian_is_archived", "paket_ujian", ["is_archived"])


def downgrade() -> None:
    op.drop_index("ix_paket_ujian_is_archived", table_name="paket_ujian")
    op.drop_column("paket_ujian", "archived_at")
    op.drop_column("paket_ujian", "is_archived")
