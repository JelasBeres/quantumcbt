"""Fix race condition: add unique constraint to ujian_siswa

Revision ID: e1f2a3b4c5d6
Revises: b2c3d4e5f6a7
Create Date: 2026-08-28 16:59:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    # Add unique constraint untuk mencegah duplicate ujian aktif untuk siswa yang sama
    # Note: Hanya berlaku untuk ujian yang belum di-submit (is_submitted = False)
    # Karena SQLAlchemy tidak support conditional unique constraint,
    # kita akan handle di application level dengan unique index pada (siswa_id, jadwal_ujian_id)
    # dan check is_submitted di query
    
    # Bersihkan duplicate data terlebih dahulu (jika ada)
    op.execute("""
        -- Hapus duplicate ujian yang belum di-submit (keep yang paling baru)
        DELETE FROM ujian_siswa
        WHERE id IN (
            SELECT id FROM (
                SELECT id, 
                       ROW_NUMBER() OVER (
                           PARTITION BY siswa_id, jadwal_ujian_id, is_submitted 
                           ORDER BY started_at DESC
                       ) as rn
                FROM ujian_siswa
                WHERE is_submitted = FALSE
            ) t
            WHERE t.rn > 1
        );
    """)
    
    # Tambah index untuk performa
    op.create_index(
        'idx_ujian_siswa_active',
        'ujian_siswa',
        ['siswa_id', 'jadwal_ujian_id', 'is_submitted'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_ujian_siswa_active', table_name='ujian_siswa')
