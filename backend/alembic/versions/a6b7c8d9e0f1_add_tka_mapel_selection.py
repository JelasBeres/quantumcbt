"""Add TKA required/optional subject configuration."""

from alembic import op
import sqlalchemy as sa

revision = "a6b7c8d9e0f1"
down_revision = "z5n6o7p8q9r0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.add_column(sa.Column("min_mapel_pilihan", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("max_mapel_pilihan", sa.Integer(), nullable=False, server_default="0"))
    with op.batch_alter_table("bagian_paket") as batch:
        batch.add_column(sa.Column("wajib", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    with op.batch_alter_table("bagian_paket") as batch:
        batch.drop_column("wajib")
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_column("max_mapel_pilihan")
        batch.drop_column("min_mapel_pilihan")
