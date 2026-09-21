"""Apply additive September 17 updates to the workspace-only SQLite database.

Legacy SQLite uses create_all plus individually applied migrations; do not stamp
the Alembic chain or run this script against another environment.
"""
from pathlib import Path
from datetime import datetime, timezone
import importlib.util
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.db.database import engine
from sqlalchemy import inspect
from alembic.operations import Operations
from alembic.migration import MigrationContext


def main():
    target = (ROOT / "dev-local.db").resolve()
    if engine.dialect.name != "sqlite" or Path(engine.url.database).resolve() != target:
        raise RuntimeError("Only workspace dev-local.db is allowed")
    if not target.is_file():
        raise RuntimeError("Existing local database is required")
    backup = ROOT / f"dev-local.before-client-17-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.db"
    with sqlite3.connect(str(target)) as source, sqlite3.connect(str(backup)) as destination:
        source.backup(destination)
    with engine.begin() as conn:
        for filename in ("j0e1f2a3b4c5_retire_speedtest.py", "k1f2a3b4c5d6_practice_and_sections.py", "l2a3b4c5d6e7_package_assignments.py"):
            if filename.startswith("l2") and any(c["name"] == "assigned_guru_ids" for c in inspect(conn).get_columns("paket_ujian")):
                continue
            if filename.startswith("k1"):
                checks = [("siswa", "pilihan_jurusan"), ("ujian_siswa", "mode_latihan"), ("ujian_siswa", "bagian_aktif")]
                present = [any(c["name"] == column for c in inspect(conn).get_columns(table)) for table, column in checks]
                if all(present):
                    continue
                if any(present):
                    raise RuntimeError("Partial migration detected; inspect before continuing")
            spec = importlib.util.spec_from_file_location(filename, ROOT / "alembic" / "versions" / filename)
            migration = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(migration)
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
    print(f"Local updates applied. Backup: {backup.name}")


if __name__ == "__main__":
    main()
