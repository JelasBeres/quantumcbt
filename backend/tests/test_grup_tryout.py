from support import default_program_id
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import SessionLocal
from app.models.siswa import Siswa
from app.models.opsi_jawaban import OpsiJawaban
from app.models.user import User
from app.core.security import get_password_hash

client = TestClient(app)


def find_non_overlapping_interval(start: datetime, duration: timedelta, existing_intervals):
    now = utc_now()
    intervals = sorted(existing_intervals)
    candidate_start = start
    for _ in range(48 * 60):
        candidate_end = candidate_start + duration
        if not any(
            candidate_start < existing_end and candidate_end > existing_start
            for existing_start, existing_end in intervals
        ):
            return candidate_start, candidate_end
        candidate_start += timedelta(minutes=1)
    raise RuntimeError("Could not find a non-overlapping jadwal interval")


def get_existing_jadwal_intervals(headers, grup_tryout_id=None):
    params = {}
    if grup_tryout_id is not None:
        params["grup_tryout_id"] = grup_tryout_id
    r = client.get("/jadwal-ujian/", params=params, headers=headers)
    assert r.status_code == 200
    return [
        (
            ensure_utc(datetime.fromisoformat(item["mulai"])),
            ensure_utc(datetime.fromisoformat(item["selesai"])),
        )
        for item in r.json()
    ]


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


def get_token(username: str, password: str, role: str = "siswa") -> tuple[str, int]:
    ensure_user(username, password, role)
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    db.close()
    return r.json()["access_token"], user.id


def test_grup_tryout_crud():
    """Admin can create, list, get, update, and delete a grup tryout."""
    token, _ = get_token("grup_crud_admin", "grup_crud_pass", "admin")
    headers = {"Authorization": f"Bearer {token}"}

    # Create
    r = client.post("/grup-tryout/", json={"nama": "Tryout A", "deskripsi": "Kelompok A"}, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["nama"] == "Tryout A"
    assert data["deskripsi"] == "Kelompok A"
    assert data["is_active"] is True
    grup_id = data["id"]

    # Duplicate name rejected
    r = client.post("/grup-tryout/", json={"nama": "Tryout A", "deskripsi": "Duplikat"}, headers=headers)
    assert r.status_code == 400
    assert "sudah digunakan" in r.json()["detail"]

    # Empty name rejected
    r = client.post("/grup-tryout/", json={"nama": "  "}, headers=headers)
    assert r.status_code == 422

    # List
    r = client.get("/grup-tryout/", headers=headers)
    assert r.status_code == 200
    assert any(item["id"] == grup_id for item in r.json())

    # Get
    r = client.get(f"/grup-tryout/{grup_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Tryout A"

    # Update
    r = client.put(f"/grup-tryout/{grup_id}", json={"nama": "Tryout A Updated", "is_active": False}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Tryout A Updated"
    assert r.json()["is_active"] is False

    # Non-admin cannot create
    user_token, _ = get_token("grup_user", "grup_user_pass", "siswa")
    user_headers = {"Authorization": f"Bearer {user_token}"}
    r = client.post("/grup-tryout/", json={"nama": "Hack"}, headers=user_headers)
    assert r.status_code == 403

    # Delete
    r = client.delete(f"/grup-tryout/{grup_id}", headers=headers)
    assert r.status_code == 200


def test_grup_tryout_protected_delete():
    """Grup used by a jadwal cannot be deleted."""
    token, _ = get_token("grup_del_admin", "grup_del_pass", "admin")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post("/grup-tryout/", json={"nama": "Tryout Delete Protected"}, headers=headers)
    assert r.status_code == 200
    grup_id = r.json()["id"]

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket Proteksi", "durasi_menit": 30, "jumlah_soal": 1}, headers=headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    intervals = get_existing_jadwal_intervals(headers)
    mulai, selesai = find_non_overlapping_interval(utc_now() + timedelta(days=367), timedelta(hours=1), intervals)

    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": selesai.isoformat(), "grup_tryout_id": grup_id},
        headers=headers,
    )
    assert r.status_code == 200

    r = client.delete(f"/grup-tryout/{grup_id}", headers=headers)
    assert r.status_code == 400
    assert "masih digunakan" in r.json()["detail"]


def test_grup_tryout_overlap_same_group():
    """Overlapping jadwal in the same group is rejected."""
    token, _ = get_token("grup_olap_admin", "grup_olap_pass", "admin")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post("/grup-tryout/", json={"nama": "Tryout Overlap"}, headers=headers)
    assert r.status_code == 200
    grup_id = r.json()["id"]

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket Overlap Grup", "durasi_menit": 30, "jumlah_soal": 1}, headers=headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    intervals = get_existing_jadwal_intervals(headers, grup_tryout_id=grup_id)
    mulai, selesai = find_non_overlapping_interval(utc_now() + timedelta(days=368), timedelta(hours=1), intervals)

    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": selesai.isoformat(), "grup_tryout_id": grup_id},
        headers=headers,
    )
    assert r.status_code == 200

    # Second schedule overlapping the same group -> rejected
    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": (mulai + timedelta(minutes=30)).isoformat(), "selesai": (selesai + timedelta(minutes=30)).isoformat(), "grup_tryout_id": grup_id},
        headers=headers,
    )
    assert r.status_code == 400
    assert "overlap" in r.json()["detail"].lower()


def test_grup_tryout_overlap_different_group_allowed():
    """Same time interval across different groups is allowed."""
    token, _ = get_token("grup_olap2_admin", "grup_olap2_pass", "admin")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post("/grup-tryout/", json={"nama": "Tryout Grup A"}, headers=headers)
    assert r.status_code == 200
    grup_a = r.json()["id"]
    r = client.post("/grup-tryout/", json={"nama": "Tryout Grup B"}, headers=headers)
    assert r.status_code == 200
    grup_b = r.json()["id"]

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket Multi Grup", "durasi_menit": 30, "jumlah_soal": 1}, headers=headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    base = utc_now() + timedelta(days=369)
    mulai_a = base
    selesai_a = base + timedelta(hours=1)
    mulai_b = base + timedelta(minutes=30)
    selesai_b = base + timedelta(hours=1, minutes=30)

    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": mulai_a.isoformat(), "selesai": selesai_a.isoformat(), "grup_tryout_id": grup_a},
        headers=headers,
    )
    assert r.status_code == 200

    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": mulai_b.isoformat(), "selesai": selesai_b.isoformat(), "grup_tryout_id": grup_b},
        headers=headers,
    )
    assert r.status_code == 200


def test_grup_tryout_start_resume_per_group():
    """POST /ujian-siswa/mulai rejects wrong grup_tryout_id and resumes correctly."""
    admin_token, _ = get_token("grup_start_admin", "grup_start_pass", "admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r = client.post("/grup-tryout/", json={"nama": "Tryout Start A"}, headers=admin_headers)
    assert r.status_code == 200
    grup_id = r.json()["id"]

    student_token, user_id = get_token("grup_student", "grup_student_pass", "siswa")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    db = SessionLocal()
    siswa = db.query(Siswa).filter(Siswa.user_id == user_id).first()
    if not siswa:
        siswa = Siswa(program_id=default_program_id(), user_id=user_id, nama_lengkap="Siswa Grup", no_induk="GRUP-001")
        db.add(siswa)
        db.commit()
        db.refresh(siswa)
    db.close()

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket Grup", "durasi_menit": 10, "jumlah_soal": 1, "is_random_soal": False, "is_random_opsi": False}, headers=admin_headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "1+1?", "tipe": "pilihan_ganda"}, headers=admin_headers)
    assert r.status_code == 200
    soal_id = r.json()["id"]

    db = SessionLocal()
    opsi1 = OpsiJawaban(soal_id=soal_id, teks_opsi="2", is_benar=True, urutan=1)
    opsi2 = OpsiJawaban(soal_id=soal_id, teks_opsi="3", is_benar=False, urutan=2)
    db.add_all([opsi1, opsi2])
    db.commit()
    db.close()

    intervals = get_existing_jadwal_intervals(admin_headers, grup_tryout_id=grup_id)
    duration = timedelta(minutes=15)
    mulai, selesai = find_non_overlapping_interval(utc_now(), duration, intervals)
    r = client.post(
        "/jadwal-ujian/",
        json={"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": selesai.isoformat(), "is_published": True, "grup_tryout_id": grup_id},
        headers=admin_headers,
    )
    assert r.status_code == 200
    jadwal_id = r.json()["id"]

    with patch("app.core.timeutils.datetime") as mock_datetime:
        fake_now = mulai + timedelta(minutes=1)
        mock_datetime.utcnow.return_value = fake_now
        mock_datetime.now.side_effect = lambda tz=None: fake_now if tz is None else fake_now.astimezone(tz)

        # Start with wrong grup_tryout_id -> rejected
        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id, "grup_tryout_id": 99999}, headers=student_headers)
        assert r.status_code == 400
        assert "tidak sesuai grup" in r.json()["detail"]

        # Start with correct grup_tryout_id -> success
        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id, "grup_tryout_id": grup_id}, headers=student_headers)
        assert r.status_code == 200
        data = r.json()
        ujian_id = data["ujian_siswa_id"]
        assert data["jadwal_ujian_id"] == jadwal_id

        # Resume with correct grup_tryout_id -> same attempt
        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id, "grup_tryout_id": grup_id}, headers=student_headers)
        assert r.status_code == 200
        resume_data = r.json()
        assert resume_data["ujian_siswa_id"] == ujian_id
        assert resume_data["soal_urutan"] == data["soal_urutan"]

        # Start without grup_tryout_id for a grouped schedule -> rejected
        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id}, headers=student_headers)
        assert r.status_code == 400
        assert "tidak sesuai grup" in r.json()["detail"]