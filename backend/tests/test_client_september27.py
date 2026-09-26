from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.siswa import Siswa
from test_soal_review_workflow import ensure_user, headers

client = TestClient(app)


def test_admin_reset_password_siswa_dari_daftar_siswa():
    ensure_user("sep27-admin", "Sep27Admin1", "admin")
    user = ensure_user("sep27-siswa", "Sep27Siswa1", "siswa")
    with SessionLocal() as db:
        if not db.query(Siswa).filter(Siswa.user_id == user.id).first():
            db.add(Siswa(user_id=user.id, nama_lengkap="Siswa Sep27"))
            db.commit()

    admin_h = headers("sep27-admin", "Sep27Admin1")
    rows = client.get("/siswa/", headers=admin_h).json()
    row = next(item for item in rows if item["user_id"] == user.id)
    # Username ikut dikirim agar admin tahu akun yang di-reset.
    assert row["username"] == "sep27-siswa"

    res = client.post("/auth/reset-password", json={"user_id": row["user_id"], "new_password": "BaruSep27a"}, headers=admin_h)
    assert res.status_code == 200
    assert client.post("/auth/login", json={"username": "sep27-siswa", "password": "BaruSep27a"}).status_code == 200
