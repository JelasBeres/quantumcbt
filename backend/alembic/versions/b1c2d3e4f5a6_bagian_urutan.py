"""ujian_siswa.bagian_urutan dan jadwal_ujian.durasi_menit_paket

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-09-05 17:45:00.000000

- ujian_siswa.bagian_urutan (JSON): struktur bagian per ujian untuk navigasi & resume.
- jadwal_ujian.durasi_menit_paket: durasi efektif paket di jadwal (override, misal total
  durasi seluruh bagian).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ujian_siswa', sa.Column('bagian_urutan', sa.JSON(), nullable=True))
    op.add_column('jadwal_ujian', sa.Column('durasi_menit_paket', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('jadwal_ujian', 'durasi_menit_paket')
    op.drop_column('ujian_siswa', 'bagian_urutan')
