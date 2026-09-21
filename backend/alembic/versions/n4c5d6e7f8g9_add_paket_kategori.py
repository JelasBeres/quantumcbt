from alembic import op
import sqlalchemy as sa

revision = "n4c5d6e7f8g9"
down_revision = "m3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("paket_ujian", sa.Column("kategori", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_paket_ujian_kategori"), "paket_ujian", ["kategori"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_paket_ujian_kategori"), table_name="paket_ujian")
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_column("kategori")
