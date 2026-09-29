"""poin soal default 2

- Default poin soal baru menjadi 2 (permintaan client 29-09-2026). Soal lama yang
  masih berpoin default 1 disamakan menjadi 2 agar bobotnya setara dengan soal baru;
  soal dengan poin lain (diisi manual) tidak diubah.
"""

from alembic import op

revision = "d9r0s1t2u3v4"
down_revision = "c8q9r0s1t2u3"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE soal SET poin = 2 WHERE poin = 1")


def downgrade():
    op.execute("UPDATE soal SET poin = 1 WHERE poin = 2")
