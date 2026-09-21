"""convert soal difficulty from number to choice text

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-09-13 14:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "soal",
        "tingkat_kesulitan",
        existing_type=sa.Integer(),
        type_=sa.String(length=20),
        nullable=False,
        server_default="sedang",
        postgresql_using="CASE WHEN tingkat_kesulitan <= 35 THEN 'mudah' WHEN tingkat_kesulitan <= 70 THEN 'sedang' ELSE 'sulit' END",
    )
    op.create_check_constraint(
        "ck_soal_tingkat_kesulitan",
        "soal",
        "tingkat_kesulitan IN ('mudah', 'sedang', 'sulit')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_soal_tingkat_kesulitan", "soal", type_="check")
    op.alter_column(
        "soal",
        "tingkat_kesulitan",
        existing_type=sa.String(length=20),
        type_=sa.Integer(),
        nullable=True,
        server_default="50",
        postgresql_using="CASE tingkat_kesulitan WHEN 'mudah' THEN 20 WHEN 'sulit' THEN 85 ELSE 50 END",
    )
