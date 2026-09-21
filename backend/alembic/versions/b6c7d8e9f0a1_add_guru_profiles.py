"""add guru profile data

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-09-14 00:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6c7d8e9f0a1"
down_revision: Union[str, None] = "a5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "guru",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("nama_lengkap", sa.String(200), nullable=False),
        sa.Column("nip", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("no_hp", sa.String(30), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_guru_user_id"),
        sa.UniqueConstraint("nip", name="uq_guru_nip"),
        sa.UniqueConstraint("email", name="uq_guru_email"),
        sa.UniqueConstraint("no_hp", name="uq_guru_no_hp"),
    )
    for column in ("user_id", "nip", "email", "no_hp"):
        op.create_index(f"ix_guru_{column}", "guru", [column])


def downgrade() -> None:
    op.drop_table("guru")
