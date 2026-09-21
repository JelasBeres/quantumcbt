from support import default_program_id, active_schedule_id
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.opsi_jawaban import OpsiJawaban
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User


client = TestClient(app)


def ensure_user(username: str, password: str, role: str = "admin") -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user


def get_token(username: str, password: str, role: str = "admin") -> tuple[str, int]:
    ensure_user(username, password, role)
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    user_id = user.id
    db.close()
    return response.json()["access_token"], user_id


def test_phase6_submit_score_breakdown_and_recompute():
    token, user_id = get_token(f"phase6admin_{uuid4().hex}", "phase6pass", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    program = client.post("/program/", json={"nama": "Phase 6 Program"}, headers=headers).json()
    pelajaran = client.post(
        "/pelajaran/",
        json={"nama": "Matematika Phase 6", "program_id": program["id"]},
        headers=headers,
    ).json()
    paket = client.post(
        "/paket-ujian/",
        json={"program_id": default_program_id(), "nama": "Paket Phase 6", "durasi_menit": 30, "jumlah_soal": 2},
        headers=headers,
    ).json()

    soal_1 = client.post(
        "/soal/",
        json={
            "paket_ujian_id": paket["id"],
            "pelajaran_id": pelajaran["id"],
            "teks_soal": "1+1?",
            "tipe": "pilihan_ganda",
        },
        headers=headers,
    ).json()
    soal_2 = client.post(
        "/soal/",
        json={
            "paket_ujian_id": paket["id"],
            "pelajaran_id": pelajaran["id"],
            "teks_soal": "2+2?",
            "tipe": "pilihan_ganda",
        },
        headers=headers,
    ).json()

    db = SessionLocal()
    correct = OpsiJawaban(soal_id=soal_1["id"], teks_opsi="2", is_benar=True, urutan=1)
    wrong = OpsiJawaban(soal_id=soal_1["id"], teks_opsi="3", is_benar=False, urutan=2)
    other_correct = OpsiJawaban(soal_id=soal_2["id"], teks_opsi="4", is_benar=True, urutan=1)
    db.add_all([correct, wrong, other_correct])
    db.commit()
    db.refresh(correct)
    correct_id = correct.id
    db.close()

    siswa = client.post(
        "/siswa/",
        json={"user_id": user_id, "nama_lengkap": "Admin Phase 6", "no_induk": f"P6-{uuid4().hex[:8]}"},
        headers=headers,
    ).json()
    ujian = client.post(
        "/ujian-siswa/",
        json={"siswa_id": siswa["id"], "paket_ujian_id": paket["id"], "jadwal_ujian_id": active_schedule_id(paket["id"])},
        headers=headers,
    ).json()

    db = SessionLocal()
    ujian_db = db.query(UjianSiswa).filter(UjianSiswa.id == ujian["id"]).first()
    assert ujian_db is not None
    ujian_db.soal_urutan = [soal_1["id"]]
    db.add(ujian_db)
    db.commit()
    db.close()

    response = client.post(
        "/jawaban-siswa/",
        json={"ujian_siswa_id": ujian["id"], "soal_id": soal_1["id"], "jawaban": str(correct_id)},
        headers=headers,
    )
    assert response.status_code == 200

    response = client.patch(f"/ujian-siswa/{ujian['id']}/submit", headers=headers)
    assert response.status_code == 200

    response = client.get(f"/hasil-ujian/ujian/{ujian['id']}", headers=headers)
    assert response.status_code == 200
    hasil = response.json()
    assert hasil["skor"] == 100.0
    assert hasil["skor_per_pelajaran_json"][str(pelajaran["id"])]["jumlah_soal"] == 1
    assert hasil["skor_per_pelajaran_json"][str(pelajaran["id"])]["jumlah_benar"] == 1

    response = client.post(f"/hasil-ujian/{ujian['id']}/compute", headers=headers)
    assert response.status_code == 200
    recomputed = response.json()
    assert recomputed["id"] == hasil["id"]
    assert recomputed["skor"] == 100.0
