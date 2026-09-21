"""bagian paket: sub-ujian dalam satu paket ujian

Revision ID: a7b8c9d0e1f2
Revises: f2g3h4i5j6k7
Create Date: 2026-09-05 17:30:00.000000

Satu paket_ujian dapat memiliki beberapa bagian (misal Matematika, Fisika, dst)
yang dikerjakan dalam satu sesi ujian dan dinilai menjadi satu kesatuan.
- Tabel baru bagian_paket (nama, urutan, durasi_menit opsional, pelajaran opsional).
- Kolom bagian_paket_id pada paket_soal agar soal bisa dikelompokkan per bagian.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f2g3h4i5j6k7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bagian_paket',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('paket_ujian_id', sa.Integer(), nullable=False),
        sa.Column('nama', sa.String(length=200), nullable=False),
        sa.Column('urutan', sa.Integer(), nullable=False),
        sa.Column('durasi_menit', sa.Integer(), nullable=True),
        sa.Column('pelajaran_id', sa.Integer(), nullable=True),
        sa.Column('is_random_soal', sa.Boolean(), nullable=True),
        sa.Column('is_random_opsi', sa.Boolean(), nullable=True),
        sa.Column('deskripsi', sa.Text(), nullable=True),
    )
    op.create_index(op.f('ix_bagian_paket_id'), 'bagian_paket', ['id'], unique=False)
    op.create_index(op.f('ix_bagian_paket_paket_ujian_id'), 'bagian_paket', ['paket_ujian_id'], unique=False)
    op.create_index(op.f('ix_bagian_paket_pelajaran_id'), 'bagian_paket', ['pelajaran_id'], unique=False)

    op.add_column('paket_soal', sa.Column('bagian_paket_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_paket_soal_bagian_paket_id'), 'paket_soal', ['bagian_paket_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_paket_soal_bagian_paket_id'), table_name='paket_soal')
    op.drop_column('paket_soal', 'bagian_paket_id')

    op.drop_index(op.f('ix_bagian_paket_pelajaran_id'), table_name='bagian_paket')
    op.drop_index(op.f('ix_bagian_paket_paket_ujian_id'), table_name='bagian_paket')
    op.drop_index(op.f('ix_bagian_paket_id'), table_name='bagian_paket')
    op.drop_table('bagian_paket')
