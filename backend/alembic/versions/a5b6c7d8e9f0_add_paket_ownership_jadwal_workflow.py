"""add package ownership and schedule approval workflow

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-09-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a5b6c7d8e9f0"
down_revision: Union[str, None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("paket_ujian", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_paket_ujian_created_by", "paket_ujian", "users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_index("ix_paket_ujian_created_by", "paket_ujian", ["created_by"])
    op.add_column("jadwal_ujian", sa.Column("status", sa.String(30), server_default="published", nullable=False))
    op.add_column("jadwal_ujian", sa.Column("created_by", sa.Integer(), nullable=True))
    op.add_column("jadwal_ujian", sa.Column("reviewed_by", sa.Integer(), nullable=True))
    op.add_column("jadwal_ujian", sa.Column("submitted_for_review_at", sa.DateTime(timezone=True)))
    op.add_column("jadwal_ujian", sa.Column("reviewed_at", sa.DateTime(timezone=True)))
    op.add_column("jadwal_ujian", sa.Column("rejection_reason", sa.Text()))
    op.create_foreign_key("fk_jadwal_ujian_created_by", "jadwal_ujian", "users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_jadwal_ujian_reviewed_by", "jadwal_ujian", "users", ["reviewed_by"], ["id"], ondelete="SET NULL")
    op.create_index("ix_jadwal_ujian_status", "jadwal_ujian", ["status"])
    op.create_index("ix_jadwal_ujian_created_by", "jadwal_ujian", ["created_by"])
    op.create_index("ix_jadwal_ujian_reviewed_by", "jadwal_ujian", ["reviewed_by"])
    op.create_check_constraint("ck_jadwal_ujian_status", "jadwal_ujian", "status IN ('draft','pending_review','rejected','published')")
    op.execute("UPDATE jadwal_ujian SET status=CASE WHEN is_published THEN 'published' ELSE 'draft' END")


def downgrade() -> None:
    op.drop_constraint("ck_jadwal_ujian_status", "jadwal_ujian", type_="check")
    for column in ("rejection_reason", "reviewed_at", "submitted_for_review_at", "reviewed_by", "created_by", "status"):
        op.drop_column("jadwal_ujian", column)
    op.drop_column("paket_ujian", "created_by")
