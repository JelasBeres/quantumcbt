"""widen opsi_jawaban.teks_opsi to TEXT

Revision ID: a9b0c1d2e3f4
Revises: f7a8b9c0d1e3
Create Date: 2026-09-10 14:40:00.000000

Teks opsi jawaban dapat berisi HTML dari paste Word yang jauh melebihi 1000
karakter, sehingga varchar(1000) memicu StringDataRightTruncation. Ubah ke TEXT.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f7a8b9c0d1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "opsi_jawaban",
        "teks_opsi",
        existing_type=sa.String(length=1000),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "opsi_jawaban",
        "teks_opsi",
        existing_type=sa.Text(),
        type_=sa.String(length=1000),
        existing_nullable=False,
    )
