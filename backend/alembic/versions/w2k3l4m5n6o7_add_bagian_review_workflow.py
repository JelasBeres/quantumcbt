from alembic import op
import sqlalchemy as sa

revision = "w2k3l4m5n6o7"
down_revision = "v1j2k3l4m5n6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("bagian_paket") as batch:
        batch.add_column(sa.Column("status", sa.String(30), nullable=False, server_default="draft"))
        batch.add_column(sa.Column("review_note", sa.Text(), nullable=True))
        batch.add_column(sa.Column("submitted_for_review_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("reviewed_by", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("revision_number", sa.Integer(), nullable=False, server_default="0"))
        batch.create_index("ix_bagian_paket_status", ["status"])
        batch.create_index("ix_bagian_paket_reviewed_by", ["reviewed_by"])
        batch.create_foreign_key(
            "fk_bagian_paket_reviewed_by_users",
            "users",
            ["reviewed_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade():
    with op.batch_alter_table("bagian_paket") as batch:
        batch.drop_constraint("fk_bagian_paket_reviewed_by_users", type_="foreignkey")
        batch.drop_index("ix_bagian_paket_reviewed_by")
        batch.drop_index("ix_bagian_paket_status")
        batch.drop_column("revision_number")
        batch.drop_column("reviewed_by")
        batch.drop_column("reviewed_at")
        batch.drop_column("submitted_for_review_at")
        batch.drop_column("review_note")
        batch.drop_column("status")
