from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jadwal_ujian", sa.Column("deletion_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("jadwal_ujian", "deletion_reason")
