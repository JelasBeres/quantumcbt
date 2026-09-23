from alembic import op
import sqlalchemy as sa

revision = "u0i1j2k3l4m5"
down_revision = "t9h0i1j2k3l4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("ujian_siswa") as batch:
        batch.add_column(sa.Column("latihan_bagian_id", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("ujian_siswa") as batch:
        batch.drop_column("latihan_bagian_id")
