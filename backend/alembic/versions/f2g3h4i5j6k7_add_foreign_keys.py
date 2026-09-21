"""Add foreign key constraints to all tables

Revision ID: f2g3h4i5j6k7
Revises: e1f2a3b4c5d6
Create Date: 2026-08-28 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2g3h4i5j6k7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    # Clean up orphaned records first (data yang referensi ke record yang tidak exist)
    
    # 1. Clean orphaned ujian_siswa
    op.execute("""
        DELETE FROM ujian_siswa 
        WHERE siswa_id NOT IN (SELECT id FROM siswa)
        OR paket_ujian_id NOT IN (SELECT id FROM paket_ujian)
        OR (jadwal_ujian_id IS NOT NULL AND jadwal_ujian_id NOT IN (SELECT id FROM jadwal_ujian));
    """)
    
    # 2. Clean orphaned jawaban_siswa
    op.execute("""
        DELETE FROM jawaban_siswa 
        WHERE ujian_siswa_id NOT IN (SELECT id FROM ujian_siswa)
        OR soal_id NOT IN (SELECT id FROM soal);
    """)
    
    # 3. Clean orphaned hasil_ujian
    op.execute("""
        DELETE FROM hasil_ujian 
        WHERE ujian_siswa_id NOT IN (SELECT id FROM ujian_siswa);
    """)
    
    # 4. Clean orphaned log_kecurangan
    op.execute("""
        DELETE FROM log_kecurangan 
        WHERE ujian_siswa_id NOT IN (SELECT id FROM ujian_siswa);
    """)
    
    # 5. Clean orphaned opsi_jawaban
    op.execute("""
        DELETE FROM opsi_jawaban 
        WHERE soal_id NOT IN (SELECT id FROM soal);
    """)
    
    # 6. Clean orphaned paket_soal
    op.execute("""
        DELETE FROM paket_soal 
        WHERE paket_ujian_id NOT IN (SELECT id FROM paket_ujian)
        OR soal_id NOT IN (SELECT id FROM soal);
    """)
    
    # 7. Clean orphaned siswa
    op.execute("""
        DELETE FROM siswa
        WHERE user_id NOT IN (SELECT id FROM users);
    """)
    
    # 8. Clean orphaned jadwal_ujian
    op.execute("""
        DELETE FROM jadwal_ujian 
        WHERE paket_ujian_id NOT IN (SELECT id FROM paket_ujian)
        OR (grup_tryout_id IS NOT NULL AND grup_tryout_id NOT IN (SELECT id FROM grup_tryout));
    """)
    
    # Now add foreign key constraints
    
    # ujian_siswa foreign keys
    op.create_foreign_key(
        'fk_ujian_siswa_siswa_id',
        'ujian_siswa', 'siswa',
        ['siswa_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_ujian_siswa_paket_ujian_id',
        'ujian_siswa', 'paket_ujian',
        ['paket_ujian_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_ujian_siswa_jadwal_ujian_id',
        'ujian_siswa', 'jadwal_ujian',
        ['jadwal_ujian_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # jawaban_siswa foreign keys
    op.create_foreign_key(
        'fk_jawaban_siswa_ujian_siswa_id',
        'jawaban_siswa', 'ujian_siswa',
        ['ujian_siswa_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_jawaban_siswa_soal_id',
        'jawaban_siswa', 'soal',
        ['soal_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # hasil_ujian foreign keys
    op.create_foreign_key(
        'fk_hasil_ujian_ujian_siswa_id',
        'hasil_ujian', 'ujian_siswa',
        ['ujian_siswa_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # log_kecurangan foreign keys
    op.create_foreign_key(
        'fk_log_kecurangan_ujian_siswa_id',
        'log_kecurangan', 'ujian_siswa',
        ['ujian_siswa_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # opsi_jawaban foreign keys
    op.create_foreign_key(
        'fk_opsi_jawaban_soal_id',
        'opsi_jawaban', 'soal',
        ['soal_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # paket_soal foreign keys
    op.create_foreign_key(
        'fk_paket_soal_paket_ujian_id',
        'paket_soal', 'paket_ujian',
        ['paket_ujian_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_paket_soal_soal_id',
        'paket_soal', 'soal',
        ['soal_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # siswa foreign keys
    op.create_foreign_key(
        'fk_siswa_user_id',
        'siswa', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # jadwal_ujian foreign keys
    op.create_foreign_key(
        'fk_jadwal_ujian_paket_ujian_id',
        'jadwal_ujian', 'paket_ujian',
        ['paket_ujian_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_jadwal_ujian_grup_tryout_id',
        'jadwal_ujian', 'grup_tryout',
        ['grup_tryout_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # login_activity foreign keys (optional, bisa null jika user dihapus)
    op.create_foreign_key(
        'fk_login_activity_user_id',
        'login_activity', 'users',
        ['user_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    # Drop all foreign keys in reverse order
    op.drop_constraint('fk_login_activity_user_id', 'login_activity', type_='foreignkey')
    op.drop_constraint('fk_jadwal_ujian_grup_tryout_id', 'jadwal_ujian', type_='foreignkey')
    op.drop_constraint('fk_jadwal_ujian_paket_ujian_id', 'jadwal_ujian', type_='foreignkey')
    op.drop_constraint('fk_siswa_user_id', 'siswa', type_='foreignkey')
    op.drop_constraint('fk_paket_soal_soal_id', 'paket_soal', type_='foreignkey')
    op.drop_constraint('fk_paket_soal_paket_ujian_id', 'paket_soal', type_='foreignkey')
    op.drop_constraint('fk_opsi_jawaban_soal_id', 'opsi_jawaban', type_='foreignkey')
    op.drop_constraint('fk_log_kecurangan_ujian_siswa_id', 'log_kecurangan', type_='foreignkey')
    op.drop_constraint('fk_hasil_ujian_ujian_siswa_id', 'hasil_ujian', type_='foreignkey')
    op.drop_constraint('fk_jawaban_siswa_soal_id', 'jawaban_siswa', type_='foreignkey')
    op.drop_constraint('fk_jawaban_siswa_ujian_siswa_id', 'jawaban_siswa', type_='foreignkey')
    op.drop_constraint('fk_ujian_siswa_jadwal_ujian_id', 'ujian_siswa', type_='foreignkey')
    op.drop_constraint('fk_ujian_siswa_paket_ujian_id', 'ujian_siswa', type_='foreignkey')
    op.drop_constraint('fk_ujian_siswa_siswa_id', 'ujian_siswa', type_='foreignkey')
