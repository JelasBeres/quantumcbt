from support import default_program_id, make_paket_ready
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import app
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, verify_password


def find_non_overlapping_interval(start: datetime, duration: timedelta, existing_intervals):
    candidate_start = start
    while True:
        candidate_end = candidate_start + duration
        conflict = False
        for existing_start, existing_end in existing_intervals:
            if candidate_start < existing_end and candidate_end > existing_start:
                conflict = True
                break
        if not conflict:
            return candidate_start, candidate_end
        candidate_start += timedelta(days=1)


def get_existing_jadwal_intervals(headers):
    r = client.get("/jadwal-ujian/", headers=headers)
    assert r.status_code == 200
    intervals = []
    for item in r.json():
        intervals.append(
            (
                ensure_utc(datetime.fromisoformat(item["mulai"])),
                ensure_utc(datetime.fromisoformat(item["selesai"])),
            )
        )
    return intervals

client = TestClient(app)


def ensure_admin(username: str, password: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role="admin")
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not verify_password(password, user.password_hash):
        user.password_hash = get_password_hash(password)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user


def get_token(username: str = "phase4admin", password: str = "phase4pass") -> str:
    ensure_admin(username, password)
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]




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


def test_jadwal_ujian_crud_and_participants():
    headers = {"Authorization": f"Bearer {get_token()}"}

    # setup program, kelas, paket
    r = client.post("/program/", json={"nama": "Program Phase 4", "deskripsi": "Program Phase 4", "is_active": True}, headers=headers)
    assert r.status_code == 200
    program_id = r.json()["id"]

    r = client.post("/kelas/", json={"nama": "Kelas 11"}, headers=headers)
    assert r.status_code == 200
    kelas_id = r.json()["id"]

    r = client.post(
        "/paket-ujian/",
        json={"program_id": default_program_id(), 
            "kategori": "utbk",
            "nama": "Paket Phase 4",
            "deskripsi": "Paket untuk jadwal ujian",
            "durasi_menit": 90,
            "jumlah_soal": 10,
            "is_random_soal": True,
            "is_random_opsi": True,
        },
        headers=headers,
    )
    assert r.status_code == 200
    paket_id = r.json()["id"]

    make_paket_ready(paket_id)
    duration = timedelta(hours=2)
    existing_intervals = get_existing_jadwal_intervals(headers)
    mulai, selesai = find_non_overlapping_interval(utc_now() + timedelta(days=365), duration, existing_intervals)
    payload = {
        "paket_ujian_id": paket_id,
        "mulai": mulai.isoformat(),
        "selesai": selesai.isoformat(),
        "is_published": False,
        "program_id": program_id,
        "kelas_id": kelas_id,
    }

    r = client.post("/jadwal-ujian/", json=payload, headers=headers)
    assert r.status_code == 200
    jadwal = r.json()
    assert jadwal["paket_ujian_id"] == paket_id
    assert jadwal["program_id"] == program_id
    assert jadwal["kelas_id"] == kelas_id
    jadwal_id = jadwal["id"]

    r = client.get(f"/jadwal-ujian/{jadwal_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == jadwal_id

    r = client.put(
        f"/jadwal-ujian/{jadwal_id}",
        json={
            "paket_ujian_id": paket_id,
            "mulai": mulai.isoformat(),
            "selesai": selesai.isoformat(),
            "is_published": True,
            "program_id": program_id,
            "kelas_id": kelas_id,
        },
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["is_published"] is True

    r = client.get(f"/jadwal-ujian/?program_id={program_id}&kelas_id={kelas_id}&is_published=true", headers=headers)
    assert r.status_code == 200
    assert any(item["id"] == jadwal_id for item in r.json())

    siswa_user = ensure_user(f"jadwalpeserta_{uuid4().hex}", "pesertapass", role="siswa")
    r = client.post(
        "/siswa/",
        json={
            "user_id": siswa_user.id,
            "nama_lengkap": "Peserta Jadwal",
            "no_induk": f"NISN001-{uuid4().hex[:8]}",
            "program_id": program_id,
            "kelas_id": kelas_id,
        },
        headers=headers,
    )
    assert r.status_code == 200
    peserta = r.json()

    other_user = ensure_user(f"otherpeserta_{uuid4().hex}", "otherpass", role="siswa")
    r = client.post(
        "/siswa/",
        json={
            "user_id": other_user.id,
            "nama_lengkap": "Peserta Lain",
            "no_induk": f"NISN002-{uuid4().hex[:8]}",
            "program_id": None,
            "kelas_id": None,
        },
        headers=headers,
    )
    assert r.status_code == 200
    other_siswa = r.json()

    r = client.get(f"/jadwal-ujian/{jadwal_id}/siswa", headers=headers)
    assert r.status_code == 200
    siswa_list = r.json()
    assert any(item["id"] == peserta["id"] for item in siswa_list)
    assert all(item["id"] != other_siswa["id"] for item in siswa_list)

    r = client.request("DELETE", f"/jadwal-ujian/{jadwal_id}", json={"alasan": "pembersihan data uji"}, headers=headers)
    assert r.status_code == 200

    r = client.get(f"/jadwal-ujian/{jadwal_id}", headers=headers)
    assert r.status_code == 404

    r = client.get("/jadwal-ujian/", headers=headers)
    assert r.status_code == 200
    assert all(item["id"] != jadwal_id for item in r.json())


def test_jadwal_ujian_overlap_validation():
    headers = {"Authorization": f"Bearer {get_token()}"}

    r = client.post(
        "/paket-ujian/",
        json={"program_id": default_program_id(), 
            "kategori": "utbk",
            "nama": "Paket Overlap",
            "deskripsi": "Paket overlap",
            "durasi_menit": 30,
            "jumlah_soal": 5,
            "is_random_soal": True,
            "is_random_opsi": True,
        },
        headers=headers,
    )
    assert r.status_code == 200
    paket_id = r.json()["id"]

    make_paket_ready(paket_id)
    duration = timedelta(hours=1)
    existing_intervals = get_existing_jadwal_intervals(headers)
    mulai, selesai = find_non_overlapping_interval(utc_now() + timedelta(days=366), duration, existing_intervals)

    r = client.post(
        "/jadwal-ujian/",
        json={
            "paket_ujian_id": paket_id,
            "mulai": mulai.isoformat(),
            "selesai": selesai.isoformat(),
            "is_published": False,
            "program_id": None,
            "kelas_id": None,
        },
        headers=headers,
    )
    assert r.status_code == 200

    r = client.post(
        "/jadwal-ujian/",
        json={
            "paket_ujian_id": paket_id,
            "mulai": (mulai + timedelta(minutes=30)).isoformat(),
            "selesai": (selesai + timedelta(minutes=30)).isoformat(),
            "is_published": False,
            "program_id": None,
            "kelas_id": None,
        },
        headers=headers,
    )
    assert r.status_code == 400
    assert "overlap" in r.json()["detail"].lower()
