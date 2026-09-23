from support import default_program_id, make_paket_ready
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import SessionLocal
from app.models.user import User
from app.models.siswa import Siswa
from app.models.opsi_jawaban import OpsiJawaban
from app.core.security import get_password_hash

client = TestClient(app)

def find_non_overlapping_interval(start: datetime, duration: timedelta, existing_intervals):
    now = utc_now()
    intervals = sorted(existing_intervals)

    # Prefer a schedule that is already active at the current time.
    active_window_start = now - duration + timedelta(minutes=1)
    candidate_start = active_window_start
    while candidate_start <= now:
        candidate_end = candidate_start + duration
        if candidate_start <= now < candidate_end and not any(
            candidate_start < existing_end and candidate_end > existing_start
            for existing_start, existing_end in intervals
        ):
            return candidate_start, candidate_end
        candidate_start += timedelta(minutes=1)

    # Otherwise fall back to the next available future slot.
    candidate_start = start
    for _ in range(48 * 60):
        candidate_end = candidate_start + duration
        if not any(candidate_start < existing_end and candidate_end > existing_start for existing_start, existing_end in intervals):
            return candidate_start, candidate_end
        candidate_start += timedelta(minutes=1)

    raise RuntimeError("Could not find a non-overlapping jadwal interval")


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


def get_token(username: str = "testuser", password: str = "testpass", role: str = "siswa") -> tuple[str, int]:
    ensure_user(username, password, role)
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    data = r.json()
    token = data["access_token"]
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    return token, user.id


def test_phase5_start_resume_and_save_answer():
    admin_token, _ = get_token(username="phase5admin", password="adminpass", role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    student_token, user_id = get_token(username="phase5siswa", password="phase5pass", role="siswa")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    db = SessionLocal()
    siswa = db.query(Siswa).filter(Siswa.user_id == user_id).first()
    if not siswa:
        siswa = Siswa(program_id=default_program_id(), user_id=user_id, nama_lengkap="Siswa Phase5", no_induk="PHASE5-001")
        db.add(siswa)
        db.commit()
        db.refresh(siswa)
    db.close()

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "kategori": "utbk", "nama": "Paket Phase 5", "durasi_menit": 10, "jumlah_soal": 1, "is_random_soal": True, "is_random_opsi": True}, headers=admin_headers)
    assert r.status_code == 200
    paket = r.json()
    paket_id = paket["id"]

    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "2+2?", "tipe": "pilihan_ganda"}, headers=admin_headers)
    assert r.status_code == 200
    soal = r.json()
    soal_id = soal["id"]

    opsi1 = OpsiJawaban(soal_id=soal_id, teks_opsi="3", is_benar=False, urutan=1)
    opsi2 = OpsiJawaban(soal_id=soal_id, teks_opsi="4", is_benar=True, urutan=2)
    db.add_all([opsi1, opsi2])
    db.commit()

    make_paket_ready(paket_id, durasi_menit=10)
    duration = timedelta(minutes=15)
    existing_intervals = get_existing_jadwal_intervals(admin_headers)
    mulai, selesai = find_non_overlapping_interval(utc_now(), duration, existing_intervals)
    r = client.post(
        "/jadwal-ujian/",
        json={
            "paket_ujian_id": paket_id,
            "mulai": mulai.isoformat(),
            "selesai": selesai.isoformat(),
            "is_published": True,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    jadwal = r.json()
    jadwal_id = jadwal["id"]

    with patch("app.core.timeutils.datetime") as mock_datetime:
        fake_now = mulai + timedelta(minutes=1)
        mock_datetime.utcnow.return_value = fake_now
        mock_datetime.now.side_effect = lambda tz=None: fake_now if tz is None else fake_now.astimezone(tz)

        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id}, headers=student_headers)
        assert r.status_code == 200
        data = r.json()

        # Resume should return the same exam and preserve soal order
        r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id}, headers=student_headers)
        assert r.status_code == 200
        resume_data = r.json()
        assert resume_data["ujian_siswa_id"] == data["ujian_siswa_id"]
        assert resume_data["soal_urutan"] == data["soal_urutan"]

        ujian_id = data["ujian_siswa_id"]
        assert data["jadwal_ujian_id"] == jadwal_id
        assert data["jumlah_soal"] == 1
        assert data["durasi_menit"] == 10
        assert data["sisa_waktu_detik"] > 0
        assert "ujian_siswa_id" in data

        # SQLite reloads started_at without timezone. State must still emit UTC,
        # and a freshly started session must retain its full duration.
        state_response = client.get(f"/ujian-siswa/{ujian_id}/state", headers=student_headers)
        assert state_response.status_code == 200
        state = state_response.json()
        started = datetime.fromisoformat(state["waktu_mulai"].replace("Z", "+00:00"))
        deadline = datetime.fromisoformat(state["waktu_selesai"].replace("Z", "+00:00"))
        assert started.utcoffset() == timedelta(0)
        assert deadline.utcoffset() == timedelta(0)
        assert deadline - started == timedelta(minutes=10)
        assert state["sisa_waktu_detik"] == data["sisa_waktu_detik"]
        assert state["status"] == "sedang"

        r = client.get(f"/ujian-siswa/{ujian_id}/soal/1", headers=student_headers)
        assert r.status_code == 200
        soal_data = r.json()
        assert soal_data["soal_id"] == soal_id
        assert len(soal_data["opsi"]) == 2
        assert soal_data["jawaban_user"] is None

        r = client.post(
            f"/ujian-siswa/{ujian_id}/jawab",
            json={"soal_id": soal_id, "opsi_jawaban_id": opsi2.id},
            headers=student_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

        r = client.get(f"/ujian-siswa/{ujian_id}/state", headers=student_headers)
        assert r.status_code == 200
        state_data = r.json()
        assert state_data["jawaban_tersimpan"][str(soal_id)] == opsi2.id
        assert state_data["status"] == "sedang"

        r = client.post(
            f"/ujian-siswa/{ujian_id}/log-kecurangan",
            json={"tipe": "tab_blur", "deskripsi": "Siswa pindah tab"},
            headers=student_headers,
        )
        assert r.status_code == 200
        log_data = r.json()
        assert log_data["ujian_siswa_id"] == ujian_id
        assert log_data["tipe_kecurangan"] == "tab_blur"

        r = client.patch(f"/ujian-siswa/{ujian_id}/submit", headers=student_headers)
        assert r.status_code == 200
        submitted = r.json()
        assert submitted["is_submitted"] is True

        # After submission, saving another answer should be rejected
        r = client.post(
            f"/ujian-siswa/{ujian_id}/jawab",
            json={"soal_id": soal_id, "opsi_jawaban_id": opsi1.id},
            headers=student_headers,
        )
        assert r.status_code == 400
        assert "submitted" in r.json()["detail"].lower()


def test_phase5_cannot_start_before_jadwal_mulai():
    admin_token, _ = get_token(username="phase5admin2", password="adminpass2", role="admin")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    student_token, student_id = get_token(username="phase5siswa2", password="phase5pass2", role="siswa")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "kategori": "utbk", "nama": "Paket Phase 5 Future", "durasi_menit": 10, "jumlah_soal": 1, "is_random_soal": False, "is_random_opsi": False}, headers=admin_headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    # schedule starts after current time and avoids overlap with other exams
    make_paket_ready(paket_id, durasi_menit=10)
    duration = timedelta(minutes=15)
    existing_intervals = get_existing_jadwal_intervals(admin_headers)
    mulai = utc_now() + timedelta(days=365)
    selesai = mulai + duration
    r = client.post(
        "/jadwal-ujian/",
        json={
            "paket_ujian_id": paket_id,
            "mulai": mulai.isoformat(),
            "selesai": selesai.isoformat(),
            "is_published": True,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    jadwal_id = r.json()["id"]

    db = SessionLocal()
    siswa = db.query(Siswa).filter(Siswa.user_id == student_id).first()
    if not siswa:
        siswa = Siswa(program_id=default_program_id(), user_id=student_id, nama_lengkap="Siswa Phase5 Future", no_induk="PHASE5-FUTURE-001")
        db.add(siswa)
        db.commit()
        db.refresh(siswa)
    db.close()

    r = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id}, headers=student_headers)
    assert r.status_code == 400
    assert "belum dimulai" in r.json()["detail"].lower()
