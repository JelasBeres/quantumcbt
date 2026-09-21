"""add scalability indexes on foreign key columns

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ujian_siswa
    op.create_index("ix_ujian_siswa_siswa_id", "ujian_siswa", ["siswa_id"])
    op.create_index("ix_ujian_siswa_paket_ujian_id", "ujian_siswa", ["paket_ujian_id"])
    op.create_index("ix_ujian_siswa_jadwal_ujian_id", "ujian_siswa", ["jadwal_ujian_id"])
    op.create_index("ix_ujian_siswa_is_submitted", "ujian_siswa", ["is_submitted"])

    # jawaban_siswa (tabel paling cepat membesar)
    op.create_index("ix_jawaban_siswa_ujian_siswa_id", "jawaban_siswa", ["ujian_siswa_id"])
    op.create_index("ix_jawaban_siswa_soal_id", "jawaban_siswa", ["soal_id"])

    # hasil_ujian
    op.create_index("ix_hasil_ujian_ujian_siswa_id", "hasil_ujian", ["ujian_siswa_id"])
    op.create_index("ix_hasil_ujian_calculated_at", "hasil_ujian", ["calculated_at"])

    # opsi_jawaban
    op.create_index("ix_opsi_jawaban_soal_id", "opsi_jawaban", ["soal_id"])

    # log_kecurangan
    op.create_index("ix_log_kecurangan_ujian_siswa_id", "log_kecurangan", ["ujian_siswa_id"])
    op.create_index("ix_log_kecurangan_created_at", "log_kecurangan", ["created_at"])

    # login_activity
    op.create_index("ix_login_activity_user_id", "login_activity", ["user_id"])
    op.create_index("ix_login_activity_created_at", "login_activity", ["created_at"])

    # siswa
    op.create_index("ix_siswa_user_id", "siswa", ["user_id"])

    # jadwal_ujian
    op.create_index("ix_jadwal_ujian_paket_ujian_id", "jadwal_ujian", ["paket_ujian_id"])
    op.create_index("ix_jadwal_ujian_program_id", "jadwal_ujian", ["program_id"])
    op.create_index("ix_jadwal_ujian_kelas_id", "jadwal_ujian", ["kelas_id"])
    op.create_index("ix_jadwal_ujian_grup_tryout_id", "jadwal_ujian", ["grup_tryout_id"])
    op.create_index("ix_jadwal_ujian_published_deleted", "jadwal_ujian", ["is_published", "is_deleted"])

    # soal
    op.create_index("ix_soal_paket_ujian_id", "soal", ["paket_ujian_id"])
    op.create_index("ix_soal_pelajaran_id", "soal", ["pelajaran_id"])
    op.create_index("ix_soal_kelas_id", "soal", ["kelas_id"])
    op.create_index("ix_soal_topik_id", "soal", ["topik_id"])

    # topik
    op.create_index("ix_topik_pelajaran_id", "topik", ["pelajaran_id"])

    # paket_ujian
    op.create_index("ix_paket_ujian_pelajaran_id", "paket_ujian", ["pelajaran_id"])

    # users
    op.create_index("ix_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_paket_ujian_pelajaran_id", table_name="paket_ujian")
    op.drop_index("ix_topik_pelajaran_id", table_name="topik")
    op.drop_index("ix_soal_topik_id", table_name="soal")
    op.drop_index("ix_soal_kelas_id", table_name="soal")
    op.drop_index("ix_soal_pelajaran_id", table_name="soal")
    op.drop_index("ix_soal_paket_ujian_id", table_name="soal")
    op.drop_index("ix_jadwal_ujian_published_deleted", table_name="jadwal_ujian")
    op.drop_index("ix_jadwal_ujian_grup_tryout_id", table_name="jadwal_ujian")
    op.drop_index("ix_jadwal_ujian_kelas_id", table_name="jadwal_ujian")
    op.drop_index("ix_jadwal_ujian_program_id", table_name="jadwal_ujian")
    op.drop_index("ix_jadwal_ujian_paket_ujian_id", table_name="jadwal_ujian")
    op.drop_index("ix_siswa_user_id", table_name="siswa")
    op.drop_index("ix_login_activity_created_at", table_name="login_activity")
    op.drop_index("ix_login_activity_user_id", table_name="login_activity")
    op.drop_index("ix_log_kecurangan_created_at", table_name="log_kecurangan")
    op.drop_index("ix_log_kecurangan_ujian_siswa_id", table_name="log_kecurangan")
    op.drop_index("ix_opsi_jawaban_soal_id", table_name="opsi_jawaban")
    op.drop_index("ix_hasil_ujian_calculated_at", table_name="hasil_ujian")
    op.drop_index("ix_hasil_ujian_ujian_siswa_id", table_name="hasil_ujian")
    op.drop_index("ix_jawaban_siswa_soal_id", table_name="jawaban_siswa")
    op.drop_index("ix_jawaban_siswa_ujian_siswa_id", table_name="jawaban_siswa")
    op.drop_index("ix_ujian_siswa_is_submitted", table_name="ujian_siswa")
    op.drop_index("ix_ujian_siswa_jadwal_ujian_id", table_name="ujian_siswa")
    op.drop_index("ix_ujian_siswa_paket_ujian_id", table_name="ujian_siswa")
    op.drop_index("ix_ujian_siswa_siswa_id", table_name="ujian_siswa")
