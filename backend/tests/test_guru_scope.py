from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.user import User
from fastapi.testclient import TestClient


client = TestClient(app)


def ensure_user(username: str, password: str, role: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role=role, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user


def login(username: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_admin_can_assign_scope_and_guru_is_enforced():
    admin = ensure_user("scope-admin", "ScopeAdmin1", "admin")
    guru = ensure_user("scope-guru", "ScopeGuru1", "guru")
    db = SessionLocal()
    program = Program(nama="Program Scope", is_active=True)
    kelas = Kelas(nama="Kelas Scope")
    db.add_all([program, kelas])
    db.flush()
    pelajaran = Pelajaran(nama="Pelajaran Scope", program_id=program.id)
    other = Pelajaran(nama="Pelajaran Lain")
    db.add_all([pelajaran, other])
    db.commit()
    ids = (program.id, kelas.id, pelajaran.id, other.id)
    db.close()

    admin_headers = login("scope-admin", "ScopeAdmin1")
    guru_headers = login("scope-guru", "ScopeGuru1")
    response = client.post(
        f"/guru-scope/user/{guru.id}",
        json={"pelajaran_id": ids[2], "program_id": ids[0], "kelas_id": ids[1]},
        headers=admin_headers,
    )
    assert response.status_code == 200

    own = client.get("/guru-scope/me", headers=guru_headers)
    assert own.status_code == 200
    assert any(row["pelajaran_id"] == ids[2] for row in own.json())

    allowed = client.post(
        "/soal/",
        json={
            "pelajaran_id": ids[2], "kelas_id": ids[1], "teks_soal": "Soal dalam scope",
            "tipe": "esai", "tingkat_kesulitan": "sedang"
        },
        headers=guru_headers,
    )
    assert allowed.status_code == 200

    denied = client.post(
        "/soal/",
        json={
            "pelajaran_id": ids[3], "kelas_id": ids[1], "teks_soal": "Soal luar scope",
            "tipe": "esai", "tingkat_kesulitan": "sedang"
        },
        headers=guru_headers,
    )
    assert denied.status_code == 403


def test_non_guru_cannot_receive_scope():
    admin = ensure_user("scope-admin-2", "ScopeAdmin2", "admin")
    siswa = ensure_user("scope-siswa", "ScopeSiswa1", "siswa")
    db = SessionLocal()
    pelajaran = Pelajaran(nama="Pelajaran Reject Scope")
    db.add(pelajaran)
    db.commit()
    pelajaran_id = pelajaran.id
    db.close()
    response = client.post(
        f"/guru-scope/user/{siswa.id}",
        json={"pelajaran_id": pelajaran_id},
        headers=login("scope-admin-2", "ScopeAdmin2"),
    )
    assert response.status_code == 400
