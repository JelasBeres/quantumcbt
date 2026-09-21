"""merge migration heads

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5, d4e5f6a7b8c1
Create Date: 2026-09-10 22:35:00.000000
"""
from typing import Sequence, Union


revision: str = "c1d2e3f4a5b6"
down_revision: tuple[str, str] = ("b0c1d2e3f4a5", "d4e5f6a7b8c1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
