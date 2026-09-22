"""Konversi soal benar_salah bentuk "simple" (2 OpsiJawaban Benar/Salah) menjadi
bentuk compound 1-pernyataan (PernyataanBenarSalah), supaya konsisten dengan
satu-satunya bentuk yang bisa dibuat/diedit lewat SoalFormModal admin/guru.

Run: .\\venv\\Scripts\\python.exe scripts/fix_benar_salah_simple.py
Aman dijalankan ulang: soal yang sudah punya pernyataan dilewati.
"""
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.models.soal import Soal
from app.models.opsi_jawaban import OpsiJawaban
from app.models.pernyataan_benar_salah import PernyataanBenarSalah

INSTRUKSI = "<p>Tentukan benar atau salah pernyataan berikut:</p>"


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Script ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-fix-bs-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")

    with SessionLocal.begin() as db:
        soal_list = db.query(Soal).filter(Soal.tipe == "benar_salah").all()
        converted = 0
        for soal in soal_list:
            if db.query(PernyataanBenarSalah).filter_by(soal_id=soal.id).first():
                continue
            opsi = db.query(OpsiJawaban).filter_by(soal_id=soal.id).all()
            if not opsi:
                continue
            benar_opsi = next((o for o in opsi if o.is_benar), None)
            statement_text = soal.teks_soal.removeprefix("<p>").removesuffix("</p>")
            db.add(PernyataanBenarSalah(
                soal_id=soal.id, teks_pernyataan=statement_text, urutan=1,
                is_benar=bool(benar_opsi and benar_opsi.teks_opsi == "Benar"),
            ))
            soal.teks_soal = INSTRUKSI
            for o in opsi:
                db.delete(o)
            converted += 1
        print(f"Selesai: {converted} soal benar_salah dikonversi ke bentuk compound.")


if __name__ == "__main__":
    main()
