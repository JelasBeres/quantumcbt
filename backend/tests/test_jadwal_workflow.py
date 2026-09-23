from datetime import datetime, timedelta, timezone

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def ensure_user(username: str, password: str, role: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role=role, is_active=True)
        db.add(user); db.commit(); db.refresh(user)
    db.expunge(user); db.close(); return user


def headers(username: str, password: str):
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_guru_package_ownership_and_schedule_approval():
    admin = ensure_user("jadwal-admin", "JadwalAdmin1", "admin")
    guru = ensure_user("jadwal-guru", "JadwalGuru1", "guru")
    guru2 = ensure_user("jadwal-guru2", "JadwalGuru2", "guru")
    db = SessionLocal()
    program = Program(nama="Program Jadwal", is_active=True)
    kelas = Kelas(nama="Kelas Jadwal")
    db.add_all([program, kelas]); db.flush()
    pelajaran = Pelajaran(nama="Pelajaran Jadwal", program_id=program.id)
    db.add(pelajaran); db.flush()
    db.add_all([
        GuruScope(user_id=guru.id, pelajaran_id=pelajaran.id, program_id=program.id, kelas_id=kelas.id),
        GuruScope(user_id=guru2.id, pelajaran_id=pelajaran.id, program_id=program.id, kelas_id=kelas.id),
    ])
    db.commit()
    ids = (program.id, kelas.id, pelajaran.id)
    db.close()

    guru_h = headers("jadwal-guru", "JadwalGuru1")
    guru2_h = headers("jadwal-guru2", "JadwalGuru2")
    admin_h = headers("jadwal-admin", "JadwalAdmin1")
    paket = client.post("/paket-ujian/", json={
        "nama": "Paket Guru Jadwal", "durasi_menit": 60, "jumlah_soal": 0,
        "program_id": ids[0], "kelas_id": ids[1], "pelajaran_id": ids[2], "tipe": "ujian", "kategori": "utbk"
    }, headers=admin_h)
    assert paket.status_code == 200
    paket_id = paket.json()["id"]
    assert paket.json()["created_by"] == admin.id
    assert client.put(f"/paket-ujian/{paket_id}/penugasan", headers=admin_h, json=[guru.id]).status_code == 410
    assert client.get(f"/paket-ujian/{paket_id}", headers=guru_h).status_code == 200
    assert client.get(f"/paket-ujian/{paket_id}", headers=guru2_h).status_code == 200
    assert client.post("/paket-ujian/", headers=guru_h, json={"nama": "Forbidden", "program_id": ids[0]}).status_code == 403

    assert client.get(f"/paket-ujian/{paket_id}", headers=guru2_h).status_code == 200

    start = datetime.now(timezone.utc) + timedelta(days=30)
    create = client.post("/jadwal-ujian/", json={
        "paket_ujian_id": paket_id,
        "mulai": start.isoformat(), "selesai": (start + timedelta(hours=2)).isoformat(),
        "is_published": True,
    }, headers=guru_h)
    assert create.status_code == 403


def test_admin_package_visible_and_guru_only_sees_own_packages():
    ensure_user("jadwal-admin-list", "JadwalList1", "admin")
    guru = ensure_user("jadwal-guru-list", "JadwalGuruList1", "guru")
    response = client.get("/paket-ujian/", headers=headers("jadwal-guru-list", "JadwalGuruList1"))
    assert response.status_code == 200
    assert all(guru.id not in (item.get("assigned_guru_ids") or []) for item in response.json())
