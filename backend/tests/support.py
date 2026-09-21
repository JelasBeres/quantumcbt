from app.db.database import SessionLocal
from app.models.program import Program
from app.models.jadwal_ujian import JadwalUjian
from datetime import datetime, timedelta, timezone


def default_program_id():
    """Reference data for API tests that do not exercise program selection."""
    with SessionLocal() as db:
        program = db.query(Program).filter(Program.nama == "QA Program").first()
        if program is None:
            program = Program(nama="QA Program", is_active=True)
            db.add(program)
            db.commit()
            db.refresh(program)
        return program.id


def active_schedule_id(paket_id):
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        jadwal = JadwalUjian(paket_ujian_id=paket_id, mulai=now - timedelta(minutes=1),
                            selesai=now + timedelta(hours=1), is_published=True, status="published")
        db.add(jadwal)
        db.commit()
        db.refresh(jadwal)
        return jadwal.id
