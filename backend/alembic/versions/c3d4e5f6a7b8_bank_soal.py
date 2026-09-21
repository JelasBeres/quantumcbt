"""bank soal: topik, paket_soal, kelas/topik di soal, pelajaran/kelas di paket

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-22 20:45:00.000000

Soal dipisah dari paket menjadi bank soal yang bisa dipakai ulang, dikelompokkan
per pelajaran -> kelas -> topik. Paket ujian kini "mengambil" soal dari bank
melalui tabel penghubung paket_soal, dan dikunci ke satu pelajaran + kelas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'topik',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pelajaran_id', sa.Integer(), nullable=False),
        sa.Column('nama', sa.String(length=150), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
    )
    op.create_index(op.f('ix_topik_id'), 'topik', ['id'], unique=False)

    op.create_table(
        'paket_soal',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('paket_ujian_id', sa.Integer(), nullable=False),
        sa.Column('soal_id', sa.Integer(), nullable=False),
        sa.Column('urutan', sa.Integer(), nullable=False),
    )
    op.create_index(op.f('ix_paket_soal_id'), 'paket_soal', ['id'], unique=False)
    op.create_index(op.f('ix_paket_soal_paket_ujian_id'), 'paket_soal', ['paket_ujian_id'], unique=False)
    op.create_index(op.f('ix_paket_soal_soal_id'), 'paket_soal', ['soal_id'], unique=False)

    op.add_column('soal', sa.Column('kelas_id', sa.Integer(), nullable=True))
    op.add_column('soal', sa.Column('topik_id', sa.Integer(), nullable=True))

    op.add_column('paket_ujian', sa.Column('pelajaran_id', sa.Integer(), nullable=True))
    op.add_column('paket_ujian', sa.Column('kelas_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('paket_ujian', 'kelas_id')
    op.drop_column('paket_ujian', 'pelajaran_id')

    op.drop_column('soal', 'topik_id')
    op.drop_column('soal', 'kelas_id')

    op.drop_index(op.f('ix_paket_soal_soal_id'), table_name='paket_soal')
    op.drop_index(op.f('ix_paket_soal_paket_ujian_id'), table_name='paket_soal')
    op.drop_index(op.f('ix_paket_soal_id'), table_name='paket_soal')
    op.drop_table('paket_soal')

    op.drop_index(op.f('ix_topik_id'), table_name='topik')
    op.drop_table('topik')
