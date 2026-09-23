"""sync schema with models (program_id paket, unique constraints)

Database lokal sempat ditambal lewat skrip apply_local_*; migrasi ini membawa
perubahan yang sama ke database baru (mis. PostgreSQL di VPS). Setiap langkah
dicek dulu, jadi aman untuk database yang sudah memilikinya.

Revision ID: y4m5n6o7p8q9
Revises: x3l4m5n6o7p8
Create Date: 2026-09-24 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "y4m5n6o7p8q9"
down_revision: Union[str, None] = "x3l4m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UNIQUES = [
    ("paket_soal", "uq_paket_soal_paket_soal", ["paket_ujian_id", "soal_id"]),
    ("ujian_siswa", "uq_ujian_siswa_siswa_jadwal", ["siswa_id", "jadwal_ujian_id"]),
]


def _has_unique(inspector, table: str, columns: list[str]) -> bool:
    for uq in inspector.get_unique_constraints(table):
        if uq["column_names"] == columns:
            return True
    return any(ix["unique"] and ix["column_names"] == columns for ix in inspector.get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    sqlite = bind.dialect.name == "sqlite"

    columns = {c["name"]: c for c in inspector.get_columns("paket_ujian")}
    if "program_id" not in columns:
        op.add_column("paket_ujian", sa.Column("program_id", sa.Integer(), nullable=True))
    if "ix_paket_ujian_program_id" not in {ix["name"] for ix in inspector.get_indexes("paket_ujian")}:
        op.create_index("ix_paket_ujian_program_id", "paket_ujian", ["program_id"])
    if columns["tipe"]["nullable"] and not sqlite:
        op.execute("UPDATE paket_ujian SET tipe = 'ujian' WHERE tipe IS NULL")
        op.alter_column("paket_ujian", "tipe", existing_type=sa.String(20), nullable=False,
                        server_default="ujian")

    for table, name, cols in UNIQUES:
        if not _has_unique(inspector, table, cols):
            if sqlite:
                with op.batch_alter_table(table) as batch_op:
                    batch_op.create_unique_constraint(name, cols)
            else:
                op.create_unique_constraint(name, table, cols)


def downgrade() -> None:
    # Tidak dibalik: pada database lama kolom/constraint ini sudah ada sebelum migrasi.
    pass
