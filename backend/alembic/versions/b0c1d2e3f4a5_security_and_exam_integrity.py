"""security sessions and exam integrity

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-09-10 22:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), server_default="0", nullable=False))
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti_hash", sa.String(64), nullable=False),
        sa.Column("family_id", sa.String(36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("replaced_by_hash", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("jti_hash", name="uq_auth_sessions_jti_hash"),
    )
    for column in ("user_id", "jti_hash", "family_id", "expires_at", "revoked_at"):
        op.create_index(f"ix_auth_sessions_{column}", "auth_sessions", [column])
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ip_address", sa.String(100), nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("blocked_until", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("ip_address", "username", name="uq_login_attempt_ip_username"),
    )
    op.create_index("ix_login_attempts_ip_address", "login_attempts", ["ip_address"])
    op.create_index("ix_login_attempts_username", "login_attempts", ["username"])
    op.create_index("ix_login_attempts_blocked_until", "login_attempts", ["blocked_until"])
    op.execute("""
        DELETE FROM jawaban_siswa a USING jawaban_siswa b
        WHERE a.ujian_siswa_id = b.ujian_siswa_id AND a.soal_id = b.soal_id AND a.id < b.id
    """)
    op.create_unique_constraint("uq_jawaban_siswa_ujian_soal", "jawaban_siswa", ["ujian_siswa_id", "soal_id"])


def downgrade() -> None:
    op.drop_constraint("uq_jawaban_siswa_ujian_soal", "jawaban_siswa", type_="unique")
    op.drop_table("login_attempts")
    op.drop_table("auth_sessions")
    op.drop_column("users", "token_version")
