"""enforce unique hasil_ujian per exam and backfill started_at

Revision ID: f6a7b8c9d0e2
Revises: f5a6b7c8d9e1
Create Date: 2026-09-07 13:00:00.000000

1. Tambah unique constraint hasil_ujian.ujian_siswa_id supaya race auto-submit
   tidak pernah membuat duplikat hasil.
2. Backfill ujian_siswa.started_at yang NULL (baris lama) agar timer tidak
   pernah "di-refill" saat runtime (lihat calculate_time_info).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e2'
down_revision: Union[str, None] = 'f5a6b7c8d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) unique hasil per ujian_siswa
    op.execute(
        "DELETE FROM hasil_ujian a USING hasil_ujian b "
        "WHERE a.id < b.id AND a.ujian_siswa_id = b.ujian_siswa_id"
    )
    op.create_unique_constraint("uq_hasil_ujian_ujian_siswa_id", "hasil_ujian", ["ujian_siswa_id"])

    # 2) backfill started_at NULL dengan waktu sekarang (UTC)
    op.execute(
        "UPDATE ujian_siswa SET started_at = NOW() "
        "WHERE started_at IS NULL AND is_submitted = false"
    )


def downgrade() -> None:
    op.drop_constraint("uq_hasil_ujian_ujian_siswa_id", "hasil_ujian", type_="unique")
