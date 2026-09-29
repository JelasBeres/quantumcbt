"""add kkm paket_ujian

- kkm: nilai minimal lulus (0-100) per paket, hanya untuk metode penilaian biasa.
  Paket lama diisi 75 agar status lulus di rekap nilai tidak berubah.
"""

from alembic import op
import sqlalchemy as sa

revision = "c8q9r0s1t2u3"
down_revision = "b7p8q9r0s1t2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("paket_ujian", sa.Column("kkm", sa.Float(), nullable=False, server_default="75"))


def downgrade():
    op.drop_column("paket_ujian", "kkm")
