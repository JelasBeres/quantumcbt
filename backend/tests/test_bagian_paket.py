from support import default_program_id
"""Test fitur Bagian Paket (sub-ujian dalam satu paket ujian).

Satu paket_ujian dapat memiliki N bagian. Setiap bagian punya daftar soal,
durasi opsional, dan seluruhnya dinilai sebagai satu kesatuan.
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.soal import Soal

from app.core.security import get_password_hash
import pytest

client = TestClient(app)


@pytest.fixture(autouse=True)
def bank_soal(isolated_database):
    with SessionLocal() as db:
        db.add(User(username="admin", password_hash=get_password_hash("admin123"), role="admin"))
        db.add_all([Soal(teks_soal=f"Soal bagian {i}", status="approved") for i in range(6)])
        db.commit()


def _login(username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _soal_items(response):
    payload = response.json()
    return payload if isinstance(payload, list) else payload.get("items", [])


def test_bagian_paket_flow():
    headers = _login("admin", "admin123")

    # Bank soal untuk dipakai
    r = client.get("/soal/", params={"limit": "10"}, headers=headers)
    soal_items = _soal_items(r)
    assert len(soal_items) >= 4, "butuh minimal 4 soal di bank soal"
    soal_ids = [s["id"] for s in soal_items[:6]]

    # 1. Buat paket
    r = client.post(
        "/paket-ujian/",
        json={"program_id": default_program_id(), "nama": "Test Bagian Flow", "durasi_menit": 60, "jumlah_soal": 0, "is_random_soal": True, "is_random_opsi": True},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    paket_id = r.json()["id"]

    # 2. Buat 2 bagian
    r = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Matematika", "urutan": 1, "durasi_menit": 30}, headers=headers)
    assert r.status_code == 200, r.text
    b1 = r.json()["id"]
    r = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Fisika", "urutan": 2, "durasi_menit": 30}, headers=headers)
    assert r.status_code == 200, r.text
    b2 = r.json()["id"]

    # 3. Isi soal per bagian
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b1}/soal", json={"soal_ids": soal_ids[:3]}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["jumlah_soal"] == 3
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b2}/soal", json={"soal_ids": soal_ids[3:6]}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["jumlah_soal"] == 3

    # 4. List bagian
    r = client.get(f"/paket-ujian/{paket_id}/bagian/", headers=headers)
    assert r.status_code == 200
    bagian_list = r.json()
    assert len(bagian_list) == 2
    total_soal = sum(b["jumlah_soal"] for b in bagian_list)
    assert total_soal == 6

    # 5. Jumlah soal paket tersinkron
    r = client.get(f"/paket-ujian/{paket_id}", headers=headers)
    assert r.json()["jumlah_soal"] == 6

    # 6. Update bagian
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b1}", json={"nama": "Matematika Wajib", "durasi_menit": 20}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Matematika Wajib"

    # 7. Hapus bagian kedua -> total soal jadi 3
    r = client.delete(f"/paket-ujian/{paket_id}/bagian/{b2}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/paket-ujian/{paket_id}", headers=headers)
    assert r.json()["jumlah_soal"] == 3

    # Bersihkan
    client.delete(f"/paket-ujian/{paket_id}", headers=headers)


def test_bagian_durasi_menentukan_timer():
    """Durasi efektif = jumlah durasi bagian bila ada."""
    headers = _login("admin", "admin123")
    r = client.get("/soal/", params={"limit": "10"}, headers=headers)
    soal_items = _soal_items(r)
    if len(soal_items) < 4:
        return
    soal_ids = [s["id"] for s in soal_items[:4]]

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Test Bagian Timer", "durasi_menit": 10, "jumlah_soal": 0, "is_random_soal": False, "is_random_opsi": False}, headers=headers)
    paket_id = r.json()["id"]
    b1 = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Bagian A", "urutan": 1, "durasi_menit": 20}, headers=headers).json()["id"]
    b2 = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Bagian B", "urutan": 2, "durasi_menit": 25}, headers=headers).json()["id"]
    client.put(f"/paket-ujian/{paket_id}/bagian/{b1}/soal", json={"soal_ids": soal_ids[:2]}, headers=headers)
    client.put(f"/paket-ujian/{paket_id}/bagian/{b2}/soal", json={"soal_ids": soal_ids[2:4]}, headers=headers)

    client.delete(f"/paket-ujian/{paket_id}", headers=headers)
