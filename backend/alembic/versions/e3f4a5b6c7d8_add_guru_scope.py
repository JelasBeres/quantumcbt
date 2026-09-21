"""add guru academic scope assignments

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-13 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "guru_scope",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("pelajaran_id", sa.Integer(), nullable=False),
        sa.Column("program_id", sa.Integer(), nullable=True),
        sa.Column("kelas_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pelajaran_id"], ["pelajaran.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["program.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["kelas_id"], ["kelas.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "pelajaran_id", "program_id", "kelas_id", name="uq_guru_scope_assignment"),
    )
    for column in ("user_id", "pelajaran_id", "program_id", "kelas_id"):
        op.create_index(f"ix_guru_scope_{column}", "guru_scope", [column])


def downgrade() -> None:
    op.drop_table("guru_scope")
