"""add paket_mapel

- paket_mapel: mapel yang ditambahkan ke paket latihan. Alur admin latihan menjadi
  Paket -> Mapel -> Set soal (bagian_paket) -> Soal; mapel boleh belum punya set.
  Diisi dari pasangan paket/mapel yang sudah ada di bagian_paket.
"""

from alembic import op
import sqlalchemy as sa

revision = "b7p8q9r0s1t2"
down_revision = "a6o7p8q9r0s1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "paket_mapel",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paket_ujian_id", sa.Integer(), sa.ForeignKey("paket_ujian.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pelajaran_id", sa.Integer(), nullable=False),
        sa.Column("urutan", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("paket_ujian_id", "pelajaran_id", name="uq_paket_mapel_paket_pelajaran"),
    )
    op.create_index("ix_paket_mapel_id", "paket_mapel", ["id"])
    op.create_index("ix_paket_mapel_paket_ujian_id", "paket_mapel", ["paket_ujian_id"])
    op.create_index("ix_paket_mapel_pelajaran_id", "paket_mapel", ["pelajaran_id"])
    op.execute(
        """
        INSERT INTO paket_mapel (paket_ujian_id, pelajaran_id, urutan)
        SELECT paket_ujian_id, pelajaran_id, MIN(urutan)
        FROM bagian_paket
        WHERE pelajaran_id IS NOT NULL
        GROUP BY paket_ujian_id, pelajaran_id
        """
    )


def downgrade():
    op.drop_index("ix_paket_mapel_pelajaran_id", table_name="paket_mapel")
    op.drop_index("ix_paket_mapel_paket_ujian_id", table_name="paket_mapel")
    op.drop_index("ix_paket_mapel_id", table_name="paket_mapel")
    op.drop_table("paket_mapel")
