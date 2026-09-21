from alembic import op
import sqlalchemy as sa

revision = "q6e7f8g9h0i1"
down_revision = "p5d6e7f8g9h0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("topik") as batch:
        batch.alter_column("is_active", existing_type=sa.Boolean(), nullable=False, server_default=sa.text("true"))
        batch.add_column(sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        batch.create_foreign_key("fk_topik_pelajaran_id", "pelajaran", ["pelajaran_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_topik_is_active", "topik", ["is_active"], unique=False)
    op.create_index("uq_topik_pelajaran_nama_lower", "topik", ["pelajaran_id", sa.text("lower(nama)")], unique=True)

    op.create_table(
        "subbab",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("topik_id", sa.Integer(), nullable=False),
        sa.Column("nama", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["topik_id"], ["topik.id"], name="fk_subbab_topik_id", ondelete="RESTRICT"),
    )
    op.create_index("ix_subbab_id", "subbab", ["id"], unique=False)
    op.create_index("ix_subbab_topik_id", "subbab", ["topik_id"], unique=False)
    op.create_index("ix_subbab_is_active", "subbab", ["is_active"], unique=False)
    op.create_index("uq_subbab_topik_nama_lower", "subbab", ["topik_id", sa.text("lower(nama)")], unique=True)

    with op.batch_alter_table("soal") as batch:
        batch.add_column(sa.Column("subbab_id", sa.Integer(), nullable=True))
        batch.create_index("ix_soal_subbab_id", ["subbab_id"], unique=False)
        batch.create_foreign_key("fk_soal_subbab_id", "subbab", ["subbab_id"], ["id"], ondelete="RESTRICT")


def downgrade():
    with op.batch_alter_table("soal") as batch:
        batch.drop_constraint("fk_soal_subbab_id", type_="foreignkey")
        batch.drop_index("ix_soal_subbab_id")
        batch.drop_column("subbab_id")
    op.drop_index("uq_subbab_topik_nama_lower", table_name="subbab")
    op.drop_index("ix_subbab_is_active", table_name="subbab")
    op.drop_index("ix_subbab_topik_id", table_name="subbab")
    op.drop_index("ix_subbab_id", table_name="subbab")
    op.drop_table("subbab")
    op.drop_index("uq_topik_pelajaran_nama_lower", table_name="topik")
    op.drop_index("ix_topik_is_active", table_name="topik")
    with op.batch_alter_table("topik") as batch:
        batch.drop_constraint("fk_topik_pelajaran_id", type_="foreignkey")
        batch.drop_column("updated_at")
        batch.drop_column("created_at")
        batch.alter_column("is_active", existing_type=sa.Boolean(), nullable=True, server_default=None)
