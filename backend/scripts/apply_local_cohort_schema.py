from pathlib import Path
from datetime import datetime, timezone
import sqlite3
import sys

from sqlalchemy import inspect, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.db.database import engine


def main():
    target = (ROOT / "dev-local.db").resolve()
    if engine.dialect.name != "sqlite" or Path(engine.url.database).resolve() != target:
        raise RuntimeError("Only workspace dev-local.db is allowed")
    if not target.is_file():
        raise RuntimeError("Existing local database is required")
    backup = ROOT / f"dev-local.before-cohort-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.db"
    with sqlite3.connect(str(target)) as source, sqlite3.connect(str(backup)) as destination:
        source.backup(destination)
    with engine.begin() as connection:
        package_columns = {column["name"] for column in inspect(connection).get_columns("paket_ujian")}
        question_columns = {column["name"] for column in inspect(connection).get_columns("soal")}
        expected_package = {"metode_penilaian", "skala_kohort"}
        present_package = expected_package & package_columns
        if present_package and present_package != expected_package:
            raise RuntimeError("Partial package schema update detected")
        if not present_package:
            connection.execute(text("ALTER TABLE paket_ujian ADD COLUMN metode_penilaian VARCHAR(20) NOT NULL DEFAULT 'biasa'"))
            connection.execute(text("ALTER TABLE paket_ujian ADD COLUMN skala_kohort VARCHAR(20) NOT NULL DEFAULT 'utbk'"))
        if "poin" not in question_columns:
            connection.execute(text("ALTER TABLE soal ADD COLUMN poin FLOAT NOT NULL DEFAULT 1"))
        connection.execute(text("UPDATE paket_ujian SET metode_penilaian = 'biasa' WHERE metode_penilaian IS NULL"))
        connection.execute(text("UPDATE paket_ujian SET skala_kohort = 'utbk' WHERE skala_kohort IS NULL"))
        connection.execute(text("UPDATE soal SET poin = 1 WHERE poin IS NULL OR poin <= 0"))
    print(f"Local cohort schema applied. Backup: {backup.name}")


if __name__ == "__main__":
    main()
