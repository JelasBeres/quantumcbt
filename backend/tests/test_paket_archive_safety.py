from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.jadwal_ujian import JadwalUjian
from app.models.paket_ujian import PaketUjian
from app.models.program import Program
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def admin_headers():
    suffix = uuid4().hex[:8]
    username, password = f"archive-admin-{suffix}", "ArchiveAdmin1"
    db = SessionLocal(); user = User(username=username, password_hash=get_password_hash(password), role="admin", is_active=True)
    db.add(user); db.commit(); db.close()
    token = client.post("/auth/login", json={"username": username, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_paket():
    db = SessionLocal(); program = Program(nama=f"Program Archive {uuid4().hex[:6]}", is_active=True); db.add(program); db.flush()
    paket = PaketUjian(nama=f"Paket Archive {uuid4().hex[:6]}", durasi_menit=30, jumlah_soal=0, program_id=program.id, tipe="ujian")
    db.add(paket); db.commit(); ids=(paket.id, program.id); db.close(); return ids


def test_package_with_schedule_cannot_be_deleted_and_can_be_archived():
    paket_id, _ = make_paket(); db=SessionLocal(); start=datetime.now(timezone.utc)+timedelta(days=1)
    jadwal=JadwalUjian(paket_ujian_id=paket_id, mulai=start, selesai=start+timedelta(hours=1), is_published=False, is_deleted=False)
    db.add(jadwal); db.commit(); jadwal_id=jadwal.id; db.close(); h=admin_headers()
    denied=client.delete(f"/paket-ujian/{paket_id}", headers=h)
    assert denied.status_code==409
    db=SessionLocal(); assert db.query(JadwalUjian).filter(JadwalUjian.id==jadwal_id).first() is not None; db.close()
    archived=client.post(f"/paket-ujian/{paket_id}/archive", headers=h)
    assert archived.status_code==200 and archived.json()["is_archived"] is True
    assert all(item["id"] != paket_id for item in client.get("/paket-ujian/", headers=h).json())
    assert any(item["id"] == paket_id for item in client.get("/paket-ujian/?include_archived=true", headers=h).json())


def test_unused_package_can_still_be_deleted():
    paket_id, _ = make_paket(); h=admin_headers()
    assert client.delete(f"/paket-ujian/{paket_id}", headers=h).status_code==200
    db=SessionLocal(); assert db.query(PaketUjian).filter(PaketUjian.id==paket_id).first() is None; db.close()
