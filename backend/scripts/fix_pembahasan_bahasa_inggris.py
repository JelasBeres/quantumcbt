"""Terjemahkan pembahasan 10 soal Bahasa Inggris (TKA, pelajaran_id=4) yang masih
berbahasa Indonesia -- soal & opsinya Inggris tapi pembahasannya Indonesia,
sehingga terlihat "campuran" saat direview.

Run: .\\venv\\Scripts\\python.exe scripts/fix_pembahasan_bahasa_inggris.py
"""
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.models.soal import Soal

PEMBAHASAN_EN = {
    54: "Singular subject 'she' in the simple present takes verb + s/es: goes.",
    55: "'Buy' is an irregular verb: buy - bought - bought.",
    56: "Conditional type 2 uses 'were' for all subjects.",
    57: "'Big' is synonymous with 'large'.",
    58: "The correct collocation is 'good at'.",
    59: "Simple past passive: was/were + past participle.",
    60: "'Since' is used with a specific point in time in the present perfect.",
    61: "'Ancient' is the opposite of 'modern'.",
    62: "'Neither of' is followed by a singular verb: is.",
    63: "Predictions based on present evidence use 'be going to'.",
}


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Script ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-fix-pembahasan-en-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")

    with SessionLocal.begin() as db:
        updated = 0
        for soal_id, teks_en in PEMBAHASAN_EN.items():
            soal = db.query(Soal).filter(Soal.id == soal_id).first()
            if not soal:
                continue
            soal.pembahasan = f"<p>{teks_en}</p>"
            updated += 1
        print(f"Selesai: {updated} pembahasan soal Bahasa Inggris diterjemahkan ke Inggris.")


if __name__ == "__main__":
    main()
