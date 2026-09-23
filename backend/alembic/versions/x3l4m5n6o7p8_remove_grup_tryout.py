"""remove grup tryout (gelombang)

Revision ID: x3l4m5n6o7p8
Revises: w2k3l4m5n6o7
Create Date: 2026-09-23 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "x3l4m5n6o7p8"
down_revision: Union[str, None] = "w2k3l4m5n6o7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("jadwal_ujian")}
    if "grup_tryout_id" in columns:
        indexes = {index["name"] for index in inspector.get_indexes("jadwal_ujian")}
        if bind.dialect.name == "sqlite":
            # SQLite tidak bisa drop kolom ber-FK secara langsung; batch mode membangun ulang tabel.
            with op.batch_alter_table("jadwal_ujian", recreate="always") as batch_op:
                if "ix_jadwal_ujian_grup_tryout_id" in indexes:
                    batch_op.drop_index("ix_jadwal_ujian_grup_tryout_id")
                batch_op.drop_column("grup_tryout_id")
        else:
            for fk in inspector.get_foreign_keys("jadwal_ujian"):
                if fk.get("referred_table") == "grup_tryout" and fk.get("name"):
                    op.drop_constraint(fk["name"], "jadwal_ujian", type_="foreignkey")
            if "ix_jadwal_ujian_grup_tryout_id" in indexes:
                op.drop_index("ix_jadwal_ujian_grup_tryout_id", table_name="jadwal_ujian")
            op.drop_column("jadwal_ujian", "grup_tryout_id")
    if inspector.has_table("grup_tryout"):
        op.drop_table("grup_tryout")


def downgrade() -> None:
    # Struktur dikembalikan tanpa data gelombang yang sudah dihapus.
    op.create_table(
        "grup_tryout",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nama", sa.String(length=200), nullable=False),
        sa.Column("deskripsi", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nama"),
    )
    op.create_index(op.f("ix_grup_tryout_id"), "grup_tryout", ["id"], unique=False)
    with op.batch_alter_table("jadwal_ujian") as batch_op:
        batch_op.add_column(sa.Column("grup_tryout_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_jadwal_ujian_grup_tryout_id", ["grup_tryout_id"])
