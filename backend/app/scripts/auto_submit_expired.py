r"""
Auto-submit expired ujian script
Run this script periodically (every 1-5 minutes) dengan cronjob atau scheduler

Usage:
    python -m app.scripts.auto_submit_expired

Di VPS dijalankan tiap menit oleh systemd timer `quantumcbt-autosubmit.timer`
(lihat deploy/).

Setup Cronjob (Linux/Mac):
    */5 * * * * cd /path/to/backend && /path/to/venv/bin/python -m app.scripts.auto_submit_expired

Setup Task Scheduler (Windows):
    - Open Task Scheduler
    - Create Basic Task
    - Trigger: Repeat every 5 minutes
    - Action: Start a program
    - Program: C:\path\to\venv\Scripts\python.exe
    - Arguments: -m app.scripts.auto_submit_expired
    - Start in: C:\path\to\backend
"""

import sys
from pathlib import Path

# Add backend root to path
backend_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(backend_root))

from app.db.database import SessionLocal
from app.models.ujian_siswa import UjianSiswa
from app.models.paket_ujian import PaketUjian
from app.core.timeutils import utc_now
from app.routers.ujian_siswa import calculate_time_info
from app.services.scoring import compute_and_store_hasil

# Output ASCII saja: console Windows (cp1252) gagal mencetak emoji, dan
# exception dari print di dalam blok try ikut membatalkan auto-submit.


def auto_submit_expired_ujian():
    """
    Auto-submit ujian yang sudah expired (waktu habis) tapi belum di-submit
    """
    db = SessionLocal()
    try:
        ujian_ids = [row.id for row in db.query(UjianSiswa.id).filter(UjianSiswa.is_submitted == False).all()]

        submitted_count = 0
        error_count = 0

        for ujian_id in ujian_ids:
            try:
                # Kunci baris & cek ulang: siswa bisa saja sedang submit sendiri.
                ujian = (
                    db.query(UjianSiswa)
                    .filter(UjianSiswa.id == ujian_id, UjianSiswa.is_submitted == False)
                    .with_for_update()
                    .first()
                )
                if not ujian or ujian.started_at is None:
                    db.rollback()
                    continue
                paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
                if not paket:
                    db.rollback()
                    continue

                # Sama dengan aturan API: drill tanpa batas waktu (-1), latihan
                # per-mapel memakai durasi bagiannya.
                sisa_waktu_detik, finish_at = calculate_time_info(ujian, paket)
                if sisa_waktu_detik != 0:
                    db.rollback()
                    continue

                ujian.is_submitted = True
                ujian.finished_at = finish_at  # waktu seharusnya selesai
                # Compute hasil dalam SATU transaksi: kalau scoring gagal,
                # rollback sehingga ujian tidak tertinggal tanpa hasil.
                compute_and_store_hasil(db, ujian)
                db.commit()
                print(f"[OK] Auto-submitted ujian_siswa_id={ujian_id} (expired at {finish_at})")
                submitted_count += 1
            except Exception as e:
                db.rollback()
                print(f"[ERROR] ujian_siswa_id={ujian_id}: {e!r}")
                error_count += 1

        print("Summary:")
        print(f"   - Total checked: {len(ujian_ids)}")
        print(f"   - Auto-submitted: {submitted_count}")
        print(f"   - Errors: {error_count}")

        return submitted_count, error_count

    except Exception as e:
        print(f"[FATAL] auto_submit_expired_ujian: {e!r}")
        db.rollback()
        return 0, 1
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Auto-submit expired ujian started at {utc_now()}")
    submitted, errors = auto_submit_expired_ujian()
    print(f"Done. Submitted: {submitted}, Errors: {errors}\n")

    # Exit with error code if there were errors
    sys.exit(1 if errors > 0 else 0)
