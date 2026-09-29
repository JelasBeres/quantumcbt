"""Masukkan soal variasi tipe (pilihan_lebih_dari_satu, benar_salah, isian) yang
kemarin orphan (ke-slice keluar) ke semua paket TKA SMA & TKA SMP, supaya setiap
mapel benar-benar punya semua tipe soal, bukan cuma pilihan_ganda.

Run: .\\venv\\Scripts\\python.exe scripts/fix_tka_soal_variasi.py
Aman dijalankan ulang: PaketSoal dihapus & dibuat ulang per bagian yang disentuh.
"""
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.paket_ujian import PaketUjian
from app.models.bagian_paket import BagianPaket
from app.models.paket_soal import PaketSoal

TKA_KATEGORI_KODE = ("tka_sma", "tka_smp")
MAPEL = ("Matematika", "Bahasa Indonesia", "Bahasa Inggris")


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Script ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-fix-tka-variasi-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")

    with SessionLocal.begin() as db:
        pelajaran_ids = {p.nama: p.id for p in db.query(Pelajaran).all() if p.nama in MAPEL}
        soal_ids_per_mapel = {
            nama: [s.id for s in db.query(Soal).filter(Soal.pelajaran_id == pid, Soal.status == "approved").order_by(Soal.id).all()]
            for nama, pid in pelajaran_ids.items()
        }

        paket_list = [p for p in db.query(PaketUjian).all() if p.kategori_ref and p.kategori_ref.kode in TKA_KATEGORI_KODE]

        touched_paket = 0
        for paket in paket_list:
            total_soal = 0
            for bagian in db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == paket.id).all():
                nama_mapel = next((m for m in MAPEL if m == bagian.nama or bagian.pelajaran_id == pelajaran_ids.get(m)), None)
                if not nama_mapel:
                    total_soal += db.query(PaketSoal).filter(PaketSoal.bagian_paket_id == bagian.id).count()
                    continue
                ids = soal_ids_per_mapel[nama_mapel]
                db.query(PaketSoal).filter(PaketSoal.bagian_paket_id == bagian.id).delete(synchronize_session=False)
                for i, soal_id in enumerate(ids):
                    db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal_id, urutan=i + 1, bagian_paket_id=bagian.id))
                total_soal += len(ids)
            paket.jumlah_soal = total_soal
            touched_paket += 1
        print(f"Selesai: {touched_paket} paket TKA SMA/SMP diperbarui, setiap mapel sekarang punya semua tipe soal.")


if __name__ == "__main__":
    main()
