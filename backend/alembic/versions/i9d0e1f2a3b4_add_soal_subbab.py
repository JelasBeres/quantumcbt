"""Add subchapter metadata to question bank."""
from alembic import op
import sqlalchemy as sa

revision = "i9d0e1f2a3b4"
down_revision = "h8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("soal", sa.Column("subbab", sa.String(150), nullable=True))
    op.create_index("ix_soal_subbab", "soal", ["subbab"])


def downgrade():
    op.drop_index("ix_soal_subbab", table_name="soal")
    with op.batch_alter_table("soal") as batch_op:
        batch_op.drop_column("subbab")
