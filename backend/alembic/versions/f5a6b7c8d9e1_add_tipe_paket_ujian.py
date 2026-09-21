"""add tipe column to paket_ujian (ujian/latihan/speedtest)

Revision ID: f5a6b7c8d9e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-07 12:00:00.000000

Jenis ujian pada paket menentukan perilaku saat siswa mengerjakan:
- 'ujian'     : ujian resmi, sekali kerjakan
- 'latihan'   : latihan, boleh diulang
- 'speedtest' : tes kilat, durasi pendek, boleh diulang
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('paket_ujian', sa.Column('tipe', sa.String(20), nullable=True, server_default='ujian'))


def downgrade() -> None:
    op.drop_column('paket_ujian', 'tipe')
