"""add dikonfirmasi_at to jawaban_siswa

- jawaban_siswa.dikonfirmasi_at: waktu siswa mengonfirmasi jawaban pada mode
  drilling. Setelah dikonfirmasi, jawaban terkunci dan hasil benar/salah soal
  itu ditampilkan (warna opsi & nomor soal) termasuk setelah halaman dimuat ulang.
"""

from alembic import op
import sqlalchemy as sa

revision = "z5n6o7p8q9r0"
down_revision = "y4m5n6o7p8q9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("jawaban_siswa") as batch:
        batch.add_column(sa.Column("dikonfirmasi_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table("jawaban_siswa") as batch:
        batch.drop_column("dikonfirmasi_at")
