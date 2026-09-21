from alembic import op
import sqlalchemy as sa

revision = "r7f8g9h0i1j2"
down_revision = "q6e7f8g9h0i1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.add_column(sa.Column("metode_penilaian", sa.String(length=20), nullable=False, server_default="biasa"))
        batch.add_column(sa.Column("skala_kohort", sa.String(length=20), nullable=False, server_default="utbk"))
        batch.create_check_constraint("ck_paket_ujian_metode_penilaian", "metode_penilaian IN ('biasa', 'kohort')")
        batch.create_check_constraint("ck_paket_ujian_skala_kohort", "skala_kohort IN ('utbk', 'tka')")
    with op.batch_alter_table("soal") as batch:
        batch.add_column(sa.Column("poin", sa.Float(), nullable=False, server_default="1"))
        batch.create_check_constraint("ck_soal_poin_positive", "poin > 0")


def downgrade():
    with op.batch_alter_table("soal") as batch:
        batch.drop_constraint("ck_soal_poin_positive", type_="check")
        batch.drop_column("poin")
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_constraint("ck_paket_ujian_skala_kohort", type_="check")
        batch.drop_constraint("ck_paket_ujian_metode_penilaian", type_="check")
        batch.drop_column("skala_kohort")
        batch.drop_column("metode_penilaian")
