"""phase5 ujian engine schema

Revision ID: 2f5c8d1e7a92
Revises: d65eec74f633
Create Date: 2026-07-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f5c8d1e7a92'
down_revision: Union[str, None] = 'd65eec74f633'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ujian_siswa', sa.Column('jadwal_ujian_id', sa.Integer(), nullable=True))
    op.add_column('ujian_siswa', sa.Column('soal_urutan', sa.JSON(), nullable=True))
    op.add_column('ujian_siswa', sa.Column('opsi_urutan', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('ujian_siswa', 'opsi_urutan')
    op.drop_column('ujian_siswa', 'soal_urutan')
    op.drop_column('ujian_siswa', 'jadwal_ujian_id')
