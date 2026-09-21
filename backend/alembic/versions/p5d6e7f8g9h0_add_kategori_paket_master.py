from alembic import op
import sqlalchemy as sa

revision = "p5d6e7f8g9h0"
down_revision = "n4c5d6e7f8g9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "kategori_paket",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kode", sa.String(length=50), nullable=False),
        sa.Column("nama", sa.String(length=100), nullable=False),
        sa.Column("deskripsi", sa.Text(), nullable=True),
        sa.Column("tipe", sa.String(length=20), nullable=False, server_default="keduanya"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("tipe IN ('ujian', 'latihan', 'keduanya')", name="ck_kategori_paket_tipe"),
        sa.UniqueConstraint("kode", name="uq_kategori_paket_kode"),
        sa.UniqueConstraint("nama", name="uq_kategori_paket_nama"),
    )
    op.create_index("ix_kategori_paket_id", "kategori_paket", ["id"])
    op.create_index("ix_kategori_paket_kode", "kategori_paket", ["kode"])
    op.create_index("ix_kategori_paket_nama", "kategori_paket", ["nama"])
    op.create_index("ix_kategori_paket_is_active", "kategori_paket", ["is_active"])

    with op.batch_alter_table("paket_ujian") as batch:
        batch.add_column(sa.Column("kategori_id", sa.Integer(), nullable=True))
        batch.create_index("ix_paket_ujian_kategori_id", ["kategori_id"], unique=False)
        batch.create_foreign_key("fk_paket_ujian_kategori_id", "kategori_paket", ["kategori_id"], ["id"], ondelete="RESTRICT")

    kategori = (("utbk", "UTBK"), ("tka_sma", "TKA SMA"), ("tka_smp", "TKA SMP"))
    for kode, nama in kategori:
        op.execute(
            sa.text("INSERT INTO kategori_paket (kode, nama, deskripsi, tipe, is_active) VALUES (:kode, :nama, :deskripsi, 'keduanya', true)").bindparams(
                kode=kode, nama=nama, deskripsi=f"Kategori {nama}"
            )
        )
    op.execute(sa.text("UPDATE paket_ujian SET kategori_id = (SELECT id FROM kategori_paket WHERE kategori_paket.kode = paket_ujian.kategori) WHERE kategori IS NOT NULL"))


def downgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_constraint("fk_paket_ujian_kategori_id", type_="foreignkey")
        batch.drop_index("ix_paket_ujian_kategori_id")
        batch.drop_column("kategori_id")
    op.drop_index("ix_kategori_paket_is_active", table_name="kategori_paket")
    op.drop_index("ix_kategori_paket_nama", table_name="kategori_paket")
    op.drop_index("ix_kategori_paket_kode", table_name="kategori_paket")
    op.drop_index("ix_kategori_paket_id", table_name="kategori_paket")
    op.drop_table("kategori_paket")
