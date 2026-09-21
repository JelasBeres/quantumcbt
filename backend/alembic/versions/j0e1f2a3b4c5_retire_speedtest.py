"""Retire speedtest packages without deleting existing attempts or answers."""
from alembic import op
import sqlalchemy as sa

revision = "j0e1f2a3b4c5"
down_revision = "i9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("UPDATE paket_ujian SET is_archived = true WHERE tipe = 'speedtest'"))


def downgrade():
    # Cannot distinguish previously archived packages: never reactivate blindly.
    pass
