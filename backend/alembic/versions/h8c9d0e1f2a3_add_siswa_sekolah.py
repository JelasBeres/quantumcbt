"""Add optional school to student profiles."""
from alembic import op
import sqlalchemy as sa

revision = "h8c9d0e1f2a3"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("siswa", sa.Column("sekolah", sa.String(200), nullable=True))


def downgrade():
    with op.batch_alter_table("siswa") as batch_op:
        batch_op.drop_column("sekolah")
