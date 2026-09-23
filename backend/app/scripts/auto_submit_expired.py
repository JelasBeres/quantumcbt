r"""
Auto-submit expired ujian script
Run this script periodically (every 1-5 minutes) dengan cronjob atau scheduler

Usage:
    python -m app.scripts.auto_submit_expired

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

from datetime import timedelta
from sqlalchemy import and_
from app.db.database import SessionLocal
from app.models.ujian_siswa import UjianSiswa
from app.models.paket_ujian import PaketUjian
from app.core.timeutils import utc_now, ensure_utc
from app.services.scoring import compute_and_store_hasil


def auto_submit_expired_ujian():
    """
    Auto-submit ujian yang sudah expired (waktu habis) tapi belum di-submit
    """
    db = SessionLocal()
    try:
        now = utc_now()
        
        # Query semua ujian yang belum di-submit
        ujian_list = (
            db.query(UjianSiswa)
            .filter(UjianSiswa.is_submitted == False)
            .all()
        )
        
        submitted_count = 0
        error_count = 0
        
        for ujian in ujian_list:
            try:
                # Get paket ujian untuk cek durasi
                paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
                if not paket:
                    continue
                
                # Check apakah ujian sudah expired
                started_at = ensure_utc(ujian.started_at)
                if not started_at:
                    continue
                    
                finish_at = started_at + timedelta(minutes=paket.durasi_menit)
                
                # Jika waktu sudah habis, auto-submit
                if now >= finish_at:
                    ujian.is_submitted = True
                    ujian.finished_at = finish_at  # Set finished_at = waktu seharusnya selesai
                    db.add(ujian)

                    # Compute hasil ujian dalam SATU transaksi: kalau scoring
                    # gagal, rollback sehingga ujian tidak tertinggal tanpa hasil.
                    try:
                        compute_and_store_hasil(db, ujian)
                        db.commit()
                        print(f"✅ Auto-submitted ujian_siswa_id={ujian.id} (expired at {finish_at})")
                        submitted_count += 1
                    except Exception as scoring_error:
                        db.rollback()
                        print(f"⚠️  Auto-submit + scoring failed for ujian_siswa_id={ujian.id}: {scoring_error}")
                        error_count += 1
                        
            except Exception as e:
                print(f"❌ Error processing ujian_siswa_id={ujian.id}: {e}")
                error_count += 1
                db.rollback()
                continue
        
        print(f"\n📊 Summary:")
        print(f"   - Total checked: {len(ujian_list)}")
        print(f"   - Auto-submitted: {submitted_count}")
        print(f"   - Errors: {error_count}")
        
        return submitted_count, error_count
        
    except Exception as e:
        print(f"❌ Fatal error in auto_submit_expired_ujian: {e}")
        db.rollback()
        return 0, 1
    finally:
        db.close()


if __name__ == "__main__":
    print(f"🤖 Auto-submit expired ujian started at {utc_now()}")
    submitted, errors = auto_submit_expired_ujian()
    print(f"✅ Done! Submitted: {submitted}, Errors: {errors}\n")
    
    # Exit with error code if there were errors
    sys.exit(1 if errors > 0 else 0)
