from support import default_program_id, active_schedule_id
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.opsi_jawaban import OpsiJawaban
from app.models.hasil_ujian import HasilUjian
from app.models.user import User
from app.models.siswa import Siswa
from app.core.security import get_password_hash, verify_password
from uuid import uuid4

client = TestClient(app)


def ensure_user(username: str, password: str, role: str = "siswa") -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if user.role != role or not verify_password(password, user.password_hash):
            user.password_hash = get_password_hash(password)
            user.role = role
            db.add(user)
            db.commit()
            db.refresh(user)
    return user


def get_token(username: str = "testuser", password: str = "testpass", role: str = "siswa") -> tuple:
    ensure_user(username, password, role)
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    data = r.json()
    token = data["access_token"]
    refresh_token = data.get("refresh_token")
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    user_id = user.id if user else None
    return token, refresh_token, user_id


def test_phase1_submission_and_autograde():
    token, refresh_token, user_id = get_token(username="adminuser", password="adminpass", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # create paket
    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "kategori": "utbk", "nama": "Paket A", "durasi_menit": 30}, headers=headers)
    assert r.status_code == 200
    paket = r.json()
    paket_id = paket["id"]

    # create soal
    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "What is 1+1?"}, headers=headers)
    assert r.status_code == 200
    soal = r.json()
    soal_id = soal["id"]

    # insert opsi jawaban directly
    db = SessionLocal()
    opsi_correct = OpsiJawaban(soal_id=soal_id, teks_opsi="2", is_benar=True, urutan=1)
    opsi_wrong = OpsiJawaban(soal_id=soal_id, teks_opsi="3", is_benar=False, urutan=2)
    db.add(opsi_correct)
    db.add(opsi_wrong)
    db.commit()
    db.refresh(opsi_correct)
    db.refresh(opsi_wrong)
    opsi_id = opsi_correct.id

    # create siswa for current user (user_id from setup)
    assert user_id is not None

    no_induk_value = f"TS-{uuid4().hex[:8]}"
    r = client.post("/siswa/", json={"user_id": user_id, "nama_lengkap": "Tester", "no_induk": no_induk_value}, headers=headers)
    if r.status_code == 400 and "sudah memiliki profil" in r.json().get("detail", ""):
        # Profil siswa untuk user ini sudah pernah dibuat oleh run test sebelumnya.
        # Cukup pakai profil yang sudah ada.
        db = SessionLocal()
        siswa = db.query(Siswa).filter(Siswa.user_id == user_id).first()
        db.close()
        assert siswa is not None
        siswa_id = siswa.id
    else:
        assert r.status_code == 200
        siswa = r.json()
        siswa_id = siswa["id"]

    # create ujian
    r = client.post("/ujian-siswa/", json={"siswa_id": siswa_id, "paket_ujian_id": paket_id, "jadwal_ujian_id": active_schedule_id(paket_id)}, headers=headers)
    assert r.status_code == 200
    ujian = r.json()
    ujian_id = ujian["id"]

    # submit jawaban
    r = client.post("/jawaban-siswa/", json={"ujian_siswa_id": ujian_id, "soal_id": soal_id, "jawaban": str(opsi_id)}, headers=headers)
    assert r.status_code == 200

    # submit ujian
    r = client.patch(f"/ujian-siswa/{ujian_id}/submit", headers=headers)
    assert r.status_code == 200

    # check hasil table
    db = SessionLocal()
    hasil = db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian_id).first()
    assert hasil is not None
    assert hasil.skor is not None
    assert hasil.skor > 0


def test_phase2_auth_refresh_and_change_password():
    token, refresh_token, user_id = get_token(username="adminuser2", password="adminpass2", role="admin")
    assert refresh_token is not None

    r = client.post("/auth/refresh-token", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    refreshed = r.json()
    assert refreshed["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/auth/change-password", json={"current_password": "adminpass2", "new_password": "Newadminpass2"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["message"] == "Password changed successfully"

    # verify login with new password works
    r = client.post("/auth/login", json={"username": "adminuser2", "password": "Newadminpass2"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_auth_logout_invalidate_tokens():
    token, refresh_token, _ = get_token(username="adminlogout", password="logoutpass", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post("/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert r.status_code == 200
    assert r.json()["message"] == "Logged out successfully"

    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 401

    r = client.post("/auth/refresh-token", json={"refresh_token": refresh_token})
    assert r.status_code == 401


def test_admin_can_access_login_activity():
    token, _, _ = get_token(username="adminactivity", password="activitypass", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/login-activity/", headers=headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
