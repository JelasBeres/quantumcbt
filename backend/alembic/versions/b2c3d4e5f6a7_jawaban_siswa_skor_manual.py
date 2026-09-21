"""add manual scoring fields to jawaban_siswa for essay questions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-22 19:56:00.000000

Soal tipe esai/isian dijawab dengan teks bebas dan tidak bisa dinilai
otomatis. Kolom ini menyimpan skor manual (0-100) yang diberikan guru/admin
per jawaban, siapa yang menilai, dan kapan dinilai.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jawaban_siswa', sa.Column('skor_manual', sa.Float(), nullable=True))
    op.add_column('jawaban_siswa', sa.Column('dinilai_oleh', sa.Integer(), nullable=True))
    op.add_column('jawaban_siswa', sa.Column('dinilai_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('jawaban_siswa', 'dinilai_at')
    op.drop_column('jawaban_siswa', 'dinilai_oleh')
    op.drop_column('jawaban_siswa', 'skor_manual')
