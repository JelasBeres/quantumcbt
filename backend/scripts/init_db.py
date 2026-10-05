"""Siapkan database SQLite lokal yang masih kosong.

Rantai migrasi Alembic lama memakai SQL khusus PostgreSQL, sehingga
`alembic upgrade head` gagal pada file SQLite baru. Script ini membuat skema
langsung dari model (sama seperti tes) lalu menandai database berada di head,
sehingga migrasi berikutnya tetap bisa dijalankan dengan `alembic upgrade head`.

PostgreSQL (VPS) tidak memakai script ini: jalankan `alembic upgrade head`.

    venv/Scripts/python.exe scripts/init_db.py
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.db.database import engine
from app.models import Base


def main() -> None:
    if engine.dialect.name != "sqlite":
        raise SystemExit("Hanya untuk SQLite lokal. Untuk PostgreSQL jalankan: alembic upgrade head")
    if inspect(engine).get_table_names():
        raise SystemExit("Database sudah berisi tabel. Untuk memperbarui skema jalankan: alembic upgrade head")
    Base.metadata.create_all(engine)
    command.stamp(Config(str(ROOT / "alembic.ini")), "head")
    print(f"Skema dibuat di {engine.url.database}. Lanjutkan dengan: python scripts/create_admin.py <username>")


if __name__ == "__main__":
    main()
