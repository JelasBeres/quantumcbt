from alembic import op
import sqlalchemy as sa

revision = "s8g9h0i1j2k3"
down_revision = "r7f8g9h0i1j2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("pelajaran") as batch:
        batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
        batch.create_index("ix_pelajaran_is_active", ["is_active"], unique=False)


def downgrade():
    with op.batch_alter_table("pelajaran") as batch:
        batch.drop_index("ix_pelajaran_is_active")
        batch.drop_column("is_active")
