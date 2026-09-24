"""add pemberitahuan siswa

- pemberitahuan: promo/info dari admin dan pemberitahuan otomatis saat jadwal
  ujian dipublikasikan (jadwal_ujian_id unik agar tidak dobel).
- pemberitahuan_dibaca: status sudah dibaca per user (badge & popup).
"""

from alembic import op
import sqlalchemy as sa

revision = "a6o7p8q9r0s1"
down_revision = "z5n6o7p8q9r0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pemberitahuan",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("judul", sa.String(200), nullable=False),
        sa.Column("isi", sa.Text(), nullable=True),
        sa.Column("jenis", sa.String(30), nullable=False, server_default="info"),
        sa.Column("tautan", sa.String(500), nullable=True),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("program.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kelas_id", sa.Integer(), sa.ForeignKey("kelas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tampil_popup", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("berlaku_sampai", sa.DateTime(timezone=True), nullable=True),
        sa.Column("jadwal_ujian_id", sa.Integer(), sa.ForeignKey("jadwal_ujian.id", ondelete="CASCADE"), nullable=True, unique=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pemberitahuan_id", "pemberitahuan", ["id"])
    op.create_index("ix_pemberitahuan_program_id", "pemberitahuan", ["program_id"])
    op.create_index("ix_pemberitahuan_kelas_id", "pemberitahuan", ["kelas_id"])
    op.create_index("ix_pemberitahuan_created_at", "pemberitahuan", ["created_at"])

    op.create_table(
        "pemberitahuan_dibaca",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pemberitahuan_id", sa.Integer(), sa.ForeignKey("pemberitahuan.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dibaca_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("pemberitahuan_id", "user_id", name="uq_pemberitahuan_dibaca"),
    )
    op.create_index("ix_pemberitahuan_dibaca_id", "pemberitahuan_dibaca", ["id"])
    op.create_index("ix_pemberitahuan_dibaca_pemberitahuan_id", "pemberitahuan_dibaca", ["pemberitahuan_id"])
    op.create_index("ix_pemberitahuan_dibaca_user_id", "pemberitahuan_dibaca", ["user_id"])


def downgrade():
    op.drop_table("pemberitahuan_dibaca")
    op.drop_table("pemberitahuan")
