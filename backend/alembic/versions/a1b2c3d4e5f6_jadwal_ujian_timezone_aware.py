"""make jadwal_ujian.mulai/selesai timezone aware

Revision ID: a1b2c3d4e5f6
Revises: 9d0e1f2a3b45
Create Date: 2026-08-22 19:35:00.000000

Kolom `mulai` dan `selesai` sebelumnya bertipe TIMESTAMP WITHOUT TIME ZONE.
Karena session Postgres berjalan pada zona waktu lokal (Asia/Jakarta, UTC+7),
nilai UTC yang dikirim aplikasi tersimpan sebagai wall-time lokal, sementara
backend membandingkannya dengan `datetime.utcnow()`. Akibatnya status jadwal
meleset tepat 7 jam (jadwal yang sedang berlangsung tetap dianggap "mendatang").

Migrasi ini mengubah kolom menjadi TIMESTAMP WITH TIME ZONE dan menafsirkan
data lama sebagai waktu lokal Asia/Jakarta, sehingga jam yang sudah terlihat
benar di UI tetap benar setelah konversi.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9d0e1f2a3b45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LOCAL_TZ = "Asia/Jakarta"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite menyimpan datetime sebagai teks tanpa offset, tidak perlu diubah.
        return

    for column in ("mulai", "selesai"):
        op.execute(
            f"ALTER TABLE jadwal_ujian "
            f"ALTER COLUMN {column} TYPE TIMESTAMP WITH TIME ZONE "
            f"USING {column} AT TIME ZONE '{LOCAL_TZ}'"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for column in ("mulai", "selesai"):
        op.execute(
            f"ALTER TABLE jadwal_ujian "
            f"ALTER COLUMN {column} TYPE TIMESTAMP WITHOUT TIME ZONE "
            f"USING {column} AT TIME ZONE '{LOCAL_TZ}'"
        )
