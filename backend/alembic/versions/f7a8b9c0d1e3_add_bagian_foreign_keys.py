"""add bagian paket foreign keys

Revision ID: f7a8b9c0d1e3
Revises: f6a7b8c9d0e2
Create Date: 2026-09-07 19:30:00.000000

Pastikan bagian paket terikat ke paket/pelajaran dan paket_soal terikat ke
bagian. Data lama yang orphan atau salah paket dinormalisasi sebelum FK dibuat.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f7a8b9c0d1e3"
down_revision: Union[str, None] = "f6a7b8c9d0e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DELETE FROM bagian_paket "
        "WHERE paket_ujian_id NOT IN (SELECT id FROM paket_ujian)"
    )
    op.execute(
        "UPDATE bagian_paket SET pelajaran_id = NULL "
        "WHERE pelajaran_id IS NOT NULL "
        "AND pelajaran_id NOT IN (SELECT id FROM pelajaran)"
    )
    op.execute(
        "UPDATE paket_soal ps SET bagian_paket_id = NULL "
        "WHERE bagian_paket_id IS NOT NULL AND NOT EXISTS ("
        "  SELECT 1 FROM bagian_paket bp "
        "  WHERE bp.id = ps.bagian_paket_id "
        "  AND bp.paket_ujian_id = ps.paket_ujian_id"
        ")"
    )

    op.create_foreign_key(
        "fk_bagian_paket_paket_ujian_id",
        "bagian_paket",
        "paket_ujian",
        ["paket_ujian_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_bagian_paket_pelajaran_id",
        "bagian_paket",
        "pelajaran",
        ["pelajaran_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_paket_soal_bagian_paket_id",
        "paket_soal",
        "bagian_paket",
        ["bagian_paket_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_paket_soal_bagian_paket_id", "paket_soal", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_bagian_paket_pelajaran_id", "bagian_paket", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_bagian_paket_paket_ujian_id", "bagian_paket", type_="foreignkey"
    )
