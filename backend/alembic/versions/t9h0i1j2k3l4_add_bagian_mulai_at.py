from alembic import op
import sqlalchemy as sa

revision = "t9h0i1j2k3l4"
down_revision = "s8g9h0i1j2k3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("ujian_siswa") as batch:
        batch.add_column(sa.Column("bagian_mulai_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table("ujian_siswa") as batch:
        batch.drop_column("bagian_mulai_at")
