"""add grup tryout

Revision ID: 9d0e1f2a3b45
Revises: 8c9d0e1f2a34
Create Date: 2026-08-12 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d0e1f2a3b45"
down_revision: Union[str, None] = "8c9d0e1f2a34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grup_tryout",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nama", sa.String(length=200), nullable=False),
        sa.Column("deskripsi", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nama"),
    )
    op.create_index(op.f("ix_grup_tryout_id"), "grup_tryout", ["id"], unique=False)
    with op.batch_alter_table("jadwal_ujian") as batch_op:
        batch_op.add_column(sa.Column("grup_tryout_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("jadwal_ujian") as batch_op:
        batch_op.drop_column("grup_tryout_id")
    op.drop_index(op.f("ix_grup_tryout_id"), table_name="grup_tryout")
    op.drop_table("grup_tryout")
