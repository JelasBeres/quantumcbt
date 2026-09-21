from alembic import op
import sqlalchemy as sa

revision = "m3b4c5d6e7f8"
down_revision = "l2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("soal", sa.Column("label_benar", sa.String(length=100), nullable=True, server_default="Benar"))
    op.add_column("soal", sa.Column("label_salah", sa.String(length=100), nullable=True, server_default="Salah"))
    op.create_table(
        "pernyataan_benar_salah",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("soal_id", sa.Integer(), nullable=False),
        sa.Column("teks_pernyataan", sa.Text(), nullable=False),
        sa.Column("urutan", sa.Integer(), nullable=False),
        sa.Column("is_benar", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["soal_id"], ["soal.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("soal_id", "urutan", name="uq_pernyataan_benar_salah_soal_urutan"),
    )
    op.create_index(op.f("ix_pernyataan_benar_salah_id"), "pernyataan_benar_salah", ["id"], unique=False)
    op.create_index(op.f("ix_pernyataan_benar_salah_soal_id"), "pernyataan_benar_salah", ["soal_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_pernyataan_benar_salah_soal_id"), table_name="pernyataan_benar_salah")
    op.drop_index(op.f("ix_pernyataan_benar_salah_id"), table_name="pernyataan_benar_salah")
    op.drop_table("pernyataan_benar_salah")
    with op.batch_alter_table("soal") as batch:
        batch.drop_column("label_salah")
        batch.drop_column("label_benar")
