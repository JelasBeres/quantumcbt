from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.hasil_ujian import HasilUjian
from app.models.paket_ujian import PaketUjian
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User


client = TestClient(app)


def ensure_admin(username: str, password: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role="admin")
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user


def ensure_user(username: str, password: str, role: str = "siswa") -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user


def get_admin_headers() -> dict[str, str]:
    username = f"phase7admin_{uuid4().hex}"
    password = "phase7pass"
    ensure_admin(username, password)
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def get_user_token(username: str, password: str, role: str = "siswa") -> tuple[str, int]:
    ensure_user(username, password, role)
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    user_id = user.id
    db.close()
    return response.json()["access_token"], user_id


def test_phase7_dashboard_endpoints():
    headers = get_admin_headers()

    response = client.get("/dashboard/statistik", headers=headers)
    assert response.status_code == 200
    statistik = response.json()
    assert "total_siswa" in statistik
    assert "ujian_berjalan" in statistik

    response = client.get("/dashboard/monitoring-ujian", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    response = client.get("/dashboard/log-kecurangan", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    response = client.get("/dashboard/hasil-analytics", headers=headers)
    assert response.status_code == 200
    analytics = response.json()
    assert "jumlah_hasil" in analytics
    assert "rata_rata_nilai" in analytics


def test_phase7_siswa_dashboard_endpoints():
    token, user_id = get_user_token(f"phase7siswa_{uuid4().hex}", "phase7pass", role="siswa")
    headers = {"Authorization": f"Bearer {token}"}
    admin_token, _ = get_user_token(f"phase7admin_{uuid4().hex}", "phase7adminpass", role="admin")

    response = client.post(
        "/siswa/",
        json={"user_id": user_id, "nama_lengkap": "Siswa Phase 7", "no_induk": f"P7-{uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200

    response = client.get("/siswa/dashboard", headers=headers)
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["siswa"]["user_id"] == user_id
    assert "jadwal_mendatang" in dashboard

    response = client.get("/siswa/jadwal-ujian", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    response = client.get("/siswa/riwayat-ujian", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_phase7_pengaturan_endpoints():
    headers = get_admin_headers()
    key = f"nama_institusi_{uuid4().hex}"

    response = client.put(f"/pengaturan/{key}", json={"value": "Quantum Research"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["value"] == "Quantum Research"

    response = client.get(f"/pengaturan/{key}", headers=headers)
    assert response.status_code == 200
    assert response.json()["key"] == key

    response = client.get("/pengaturan/", headers=headers)
    assert response.status_code == 200
    assert any(item["key"] == key for item in response.json())


def test_phase7_dashboard_hasil_siswa_endpoint():
    headers = get_admin_headers()
    _, user_id = get_user_token(f"phase7hasil_{uuid4().hex}", "phase7pass", role="siswa")

    db = SessionLocal()
    siswa = Siswa(user_id=user_id, nama_lengkap="Siswa Hasil Phase 7", no_induk=f"H7-{uuid4().hex[:8]}")
    paket = PaketUjian(nama="Paket Hasil Phase 7", durasi_menit=30, jumlah_soal=1)
    db.add_all([siswa, paket])
    db.commit()
    db.refresh(siswa)
    db.refresh(paket)

    ujian = UjianSiswa(siswa_id=siswa.id, paket_ujian_id=paket.id, is_submitted=True)
    db.add(ujian)
    db.commit()
    db.refresh(ujian)

    hasil = HasilUjian(ujian_siswa_id=ujian.id, skor=88.0)
    db.add(hasil)
    db.commit()
    db.refresh(hasil)
    siswa_id = siswa.id
    paket_id = paket.id
    hasil_id = hasil.id
    db.close()

    response = client.get(f"/dashboard/hasil-siswa?siswa_id={siswa_id}&paket_ujian_id={paket_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert any(item["hasil_ujian_id"] == hasil_id and item["skor"] == 88.0 for item in data)
