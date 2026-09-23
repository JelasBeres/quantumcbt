"""Test fitur Bagian Paket (sub-ujian dalam satu paket ujian).

Satu paket_ujian dapat memiliki N bagian. Admin membuat bagian per mata pelajaran;
guru pengampu mengisi soal dan durasi. Total soal dan durasi paket selalu mengikuti
jumlah seluruh bagian.
"""
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.soal import Soal
from app.models.user import User

client = TestClient(app)


def _login(username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _setup():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        program = Program(nama=f"Program {suffix}", is_active=True)
        admin = User(username=f"admin-bagian-{suffix}", password_hash=get_password_hash("Admin123"), role="admin")
        guru = User(username=f"guru-bagian-{suffix}", password_hash=get_password_hash("Guru123"), role="guru")
        db.add_all([program, admin, guru])
        db.flush()
        subjects = [Pelajaran(nama=f"{nama} {suffix}", program_id=program.id) for nama in ("Matematika", "Fisika")]
        db.add_all(subjects)
        db.flush()
        soal_ids = {}
        for subject in subjects:
            db.add(GuruScope(user_id=guru.id, pelajaran_id=subject.id, program_id=program.id))
            questions = [Soal(pelajaran_id=subject.id, teks_soal=f"Soal {i} {subject.nama}", status="approved") for i in range(3)]
            db.add_all(questions)
            db.flush()
            soal_ids[subject.id] = [q.id for q in questions]
        db.commit()
        return {
            "admin": _login(admin.username, "Admin123"),
            "guru": _login(guru.username, "Guru123"),
            "program_id": program.id,
            "subjects": [s.id for s in subjects],
            "soal_ids": soal_ids,
        }


def _paket_dengan_dua_bagian(data):
    admin = data["admin"]
    r = client.post("/paket-ujian/", json={"program_id": data["program_id"], "kategori": "utbk", "nama": "Test Bagian", "jumlah_soal": 0}, headers=admin)
    assert r.status_code == 200, r.text
    paket_id = r.json()["id"]
    bagian_ids = []
    for urutan, pelajaran_id in enumerate(data["subjects"], start=1):
        r = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": f"Bagian {urutan}", "urutan": urutan, "pelajaran_id": pelajaran_id}, headers=admin)
        assert r.status_code == 200, r.text
        bagian_ids.append(r.json()["id"])
    return paket_id, bagian_ids


def test_bagian_paket_flow():
    data = _setup()
    admin, guru = data["admin"], data["guru"]
    paket_id, (b1, b2) = _paket_dengan_dua_bagian(data)
    s1, s2 = data["subjects"]

    # Guru mengisi soal per bagian sesuai mapelnya.
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b1}/soal", json={"soal_ids": data["soal_ids"][s1]}, headers=guru)
    assert r.status_code == 200, r.text
    assert r.json()["jumlah_soal"] == 3
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b2}/soal", json={"soal_ids": data["soal_ids"][s2]}, headers=guru)
    assert r.status_code == 200, r.text
    assert r.json()["jumlah_soal"] == 3

    bagian_list = client.get(f"/paket-ujian/{paket_id}/bagian/", headers=admin).json()
    assert len(bagian_list) == 2
    assert sum(b["jumlah_soal"] for b in bagian_list) == 6
    assert client.get(f"/paket-ujian/{paket_id}", headers=admin).json()["jumlah_soal"] == 6

    # Admin boleh mengganti nama bagian, tetapi tidak mengatur durasi.
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{b1}", json={"nama": "Matematika Wajib"}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["nama"] == "Matematika Wajib"

    # Hapus bagian kedua -> total soal paket ikut turun.
    assert client.delete(f"/paket-ujian/{paket_id}/bagian/{b2}", headers=admin).status_code == 200
    assert client.get(f"/paket-ujian/{paket_id}", headers=admin).json()["jumlah_soal"] == 3


def test_bagian_durasi_menentukan_timer():
    """Durasi paket = jumlah durasi seluruh bagian."""
    data = _setup()
    admin, guru = data["admin"], data["guru"]
    paket_id, (b1, b2) = _paket_dengan_dua_bagian(data)

    assert client.patch(f"/paket-ujian/{paket_id}/bagian/{b1}/durasi", json={"durasi_menit": 20}, headers=guru).status_code == 200
    assert client.patch(f"/paket-ujian/{paket_id}/bagian/{b2}/durasi", json={"durasi_menit": 25}, headers=guru).status_code == 200
    assert client.get(f"/paket-ujian/{paket_id}", headers=admin).json()["durasi_menit"] == 45

    assert client.delete(f"/paket-ujian/{paket_id}/bagian/{b2}", headers=admin).status_code == 200
    assert client.get(f"/paket-ujian/{paket_id}", headers=admin).json()["durasi_menit"] == 20
