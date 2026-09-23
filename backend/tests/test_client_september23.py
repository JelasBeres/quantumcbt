from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from support import active_schedule_id
from test_client_september17 import setup_exam

client = TestClient(app)


def test_latihan_mapel_tryout_terbuka_setelah_tryout_selesai():
    headers, paket, _ = setup_exam(tipe="ujian", sections=True)
    with SessionLocal() as db:
        bagian_id = db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket).order_by(BagianPaket.urutan).first()[0]
        siswa_id = db.query(Siswa.id).join(User, Siswa.user_id == User.id).filter(User.username == "newflow").scalar()
    payload = {"paket_ujian_id": paket, "mode": "latihan", "bagian_id": bagian_id}

    blocked = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload)
    assert blocked.status_code == 409
    assert "setelah tryout" in blocked.json()["detail"]

    jadwal_id = active_schedule_id(paket)
    with SessionLocal() as db:
        db.add(UjianSiswa(siswa_id=siswa_id, paket_ujian_id=paket, jadwal_ujian_id=jadwal_id, is_submitted=True))
        db.commit()

    allowed = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload)
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["jadwal_ujian_id"] is None


def test_waktu_jadwal_dikirim_sebagai_utc():
    _, paket, _ = setup_exam(tipe="ujian", sections=True)
    jadwal_id = active_schedule_id(paket)
    with SessionLocal() as db:
        db.add(User(username="jadwal-admin", password_hash=get_password_hash("Admin12345"), role="admin"))
        db.commit()
    token = client.post("/auth/login", json={"username": "jadwal-admin", "password": "Admin12345"}).json()["access_token"]
    admin = {"Authorization": f"Bearer {token}"}

    detail = client.get(f"/jadwal-ujian/{jadwal_id}", headers=admin)
    assert detail.status_code == 200, detail.text
    # Tanpa penanda zona, browser membaca waktu UTC sebagai waktu lokal (bergeser 7 jam di WIB).
    assert detail.json()["mulai"].endswith("Z")
    assert detail.json()["selesai"].endswith("Z")
    listed = next(item for item in client.get("/jadwal-ujian/", headers=admin).json() if item["id"] == jadwal_id)
    assert listed["mulai"] == detail.json()["mulai"]
