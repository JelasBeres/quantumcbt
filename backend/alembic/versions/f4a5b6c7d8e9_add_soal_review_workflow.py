"""add ownership and approval workflow for soal

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-09-13 23:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("soal", sa.Column("status", sa.String(30), server_default="approved", nullable=False))
    op.add_column("soal", sa.Column("created_by", sa.Integer(), nullable=True))
    op.add_column("soal", sa.Column("reviewed_by", sa.Integer(), nullable=True))
    op.add_column("soal", sa.Column("submitted_for_review_at", sa.DateTime(timezone=True)))
    op.add_column("soal", sa.Column("reviewed_at", sa.DateTime(timezone=True)))
    op.add_column("soal", sa.Column("rejection_reason", sa.Text()))
    op.add_column("soal", sa.Column("published_at", sa.DateTime(timezone=True)))
    op.add_column("soal", sa.Column("archived_at", sa.DateTime(timezone=True)))
    op.add_column("soal", sa.Column("parent_soal_id", sa.Integer(), nullable=True))
    op.add_column("soal", sa.Column("version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("soal", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("soal", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_foreign_key("fk_soal_created_by", "soal", "users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_soal_reviewed_by", "soal", "users", ["reviewed_by"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_soal_parent_soal_id", "soal", "soal", ["parent_soal_id"], ["id"], ondelete="SET NULL")
    for column in ("status", "created_by", "reviewed_by", "parent_soal_id"):
        op.create_index(f"ix_soal_{column}", "soal", [column])
    op.create_check_constraint("ck_soal_status", "soal", "status IN ('draft','pending_review','rejected','approved','archived')")
    op.execute("UPDATE soal SET status='approved', published_at=now() WHERE status IS NULL OR status='approved'")

    op.create_table(
        "soal_review_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("soal_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("from_status", sa.String(30)),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["soal_id"], ["soal.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    for column in ("soal_id", "actor_user_id", "action", "created_at"):
        op.create_index(f"ix_soal_review_history_{column}", "soal_review_history", [column])


def downgrade() -> None:
    op.drop_table("soal_review_history")
    op.drop_constraint("ck_soal_status", "soal", type_="check")
    for column in ("updated_at", "created_at", "version", "parent_soal_id", "archived_at", "published_at", "rejection_reason", "reviewed_at", "submitted_for_review_at", "reviewed_by", "created_by", "status"):
        op.drop_column("soal", column)
