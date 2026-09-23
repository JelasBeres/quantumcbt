from alembic import op
import sqlalchemy as sa

revision = "v1j2k3l4m5n6"
down_revision = "u0i1j2k3l4m5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.add_column(sa.Column("izinkan_pilih_mapel", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_column("izinkan_pilih_mapel")
