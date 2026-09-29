"""Perbaiki instruksi benar/salah pada 2 soal Bahasa Inggris (LBE UTBK & TKA Bahasa Inggris)
yang kemarin ke-convert pakai instruksi Bahasa Indonesia, jadi tampak "campuran" bahasa.

Run: .\\venv\\Scripts\\python.exe scripts/fix_bs_bahasa_inggris.py
"""
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.models.soal import Soal
from app.models.pernyataan_benar_salah import PernyataanBenarSalah

INSTRUKSI_EN = "<p>Determine whether the following statement is true or false:</p>"


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Script ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-fix-bs-en-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")

    with SessionLocal.begin() as db:
        # id 133 = LBE UTBK, id 151 = Bahasa Inggris TKA
        for soal_id in (133, 151):
            soal = db.query(Soal).filter(Soal.id == soal_id).first()
            if not soal:
                continue
            soal.teks_soal = INSTRUKSI_EN
            pern = db.query(PernyataanBenarSalah).filter_by(soal_id=soal_id).first()
            if pern and pern.teks_pernyataan.startswith("Statement: "):
                # buang prefiks "Statement: '...'" yang jadi redundan setelah instruksi diganti
                pern.teks_pernyataan = pern.teks_pernyataan.removeprefix("Statement: ").strip("'")
        print("Selesai: instruksi 2 soal benar/salah Bahasa Inggris diperbaiki.")


if __name__ == "__main__":
    main()
