from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.soal import Soal
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def ensure_user(username: str, password: str, role: str):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role=role, is_active=True)
        db.add(user); db.commit(); db.refresh(user)
    db.expunge(user); db.close(); return user


def headers(username: str, password: str):
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_student_cannot_list_or_open_packages():
    ensure_user("leak-student", "LeakStudent1", "siswa")
    student_h = headers("leak-student", "LeakStudent1")
    assert client.get("/paket-ujian/", headers=student_h).status_code == 403
    assert client.get("/paket-ujian/1", headers=student_h).status_code == 403


def test_student_cannot_preview_approved_question_by_id():
    ensure_user("leak-student-preview", "LeakStudent2", "siswa")
    admin = ensure_user("leak-admin", "LeakAdmin1", "admin")
    db = SessionLocal()
    soal = Soal(teks_soal="Soal rahasia", tipe="esai", tingkat_kesulitan="sedang", status="approved", created_by=admin.id)
    db.add(soal); db.commit(); soal_id = soal.id; db.close()
    assert client.get(f"/soal/{soal_id}/preview", headers=headers("leak-student-preview", "LeakStudent2")).status_code == 403


def test_staff_package_detail_remains_available():
    ensure_user("leak-admin-detail", "LeakAdmin2", "admin")
    response = client.get("/paket-ujian/", headers=headers("leak-admin-detail", "LeakAdmin2"))
    assert response.status_code == 200
