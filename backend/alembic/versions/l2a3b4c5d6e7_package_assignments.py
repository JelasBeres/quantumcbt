"""Explicit package assignments for teachers."""
from alembic import op
import sqlalchemy as sa
revision = "l2a3b4c5d6e7"
down_revision = "k1f2a3b4c5d6"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("paket_ujian", sa.Column("assigned_guru_ids", sa.JSON(), nullable=True))

def downgrade():
    with op.batch_alter_table("paket_ujian") as batch:
        batch.drop_column("assigned_guru_ids")
