"""Practice mode and current Tryout section."""
from alembic import op
import sqlalchemy as sa

revision = "k1f2a3b4c5d6"
down_revision = "j0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("siswa", sa.Column("pilihan_jurusan", sa.JSON(), nullable=True))
    op.add_column("ujian_siswa", sa.Column("mode_latihan", sa.String(20), nullable=True))
    op.add_column("ujian_siswa", sa.Column("bagian_aktif", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    with op.batch_alter_table("siswa") as batch:
        batch.drop_column("pilihan_jurusan")
    with op.batch_alter_table("ujian_siswa") as batch:
        batch.drop_column("bagian_aktif")
        batch.drop_column("mode_latihan")
