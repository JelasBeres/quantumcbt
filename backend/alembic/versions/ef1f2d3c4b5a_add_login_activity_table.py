"""add login activity table

Revision ID: ef1f2d3c4b5a
Revises: d3a7cb98d79d
Create Date: 2026-07-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ef1f2d3c4b5a'
down_revision = 'd3a7cb98d79d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'login_activity',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('ip_address', sa.String(length=100), nullable=True),
        sa.Column('successful', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('login_activity')
