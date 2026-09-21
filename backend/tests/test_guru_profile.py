from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.user import User
from fastapi.testclient import TestClient
from uuid import uuid4

client = TestClient(app)


def admin_headers():
    db = SessionLocal()
    username, password = "guru-profile-admin", "GuruProfile1"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role="admin", is_active=True)
        db.add(user); db.commit()
    db.close()
    response = client.post("/auth/login", json={"username": username, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def refs():
    db = SessionLocal()
    program = Program(nama="Program Profil Guru", is_active=True)
    kelas = Kelas(nama="Kelas Profil Guru")
    db.add_all([program, kelas]); db.flush()
    pelajaran = Pelajaran(nama="Pelajaran Profil Guru", program_id=program.id)
    db.add(pelajaran); db.commit()
    values = program.id, kelas.id, pelajaran.id
    db.close(); return values


def test_create_and_update_integrated_guru_profile():
    program_id, kelas_id, pelajaran_id = refs()
    suffix = uuid4().hex[:8]
    payload = {
        "username": f"guru-profile-{suffix}", "password": "GuruCreated1",
        "nama_lengkap": "Guru Profil Lengkap", "nip": f"NIP-{suffix}",
        "email": f"guru.{suffix}@example.com", "no_hp": f"08{suffix}",
        "scopes": [{"pelajaran_id": pelajaran_id, "program_id": program_id, "kelas_id": kelas_id}],
    }
    response = client.post("/guru-scope/profiles", json=payload, headers=admin_headers())
    assert response.status_code == 200
    body = response.json()
    assert body["nama_lengkap"] == "Guru Profil Lengkap"
    assert len(body["scopes"]) == 1
    db = SessionLocal()
    user = db.query(User).filter(User.id == body["user_id"]).first()
    assert user.role == "guru"
    db.close()

    update = client.put(f"/guru-scope/profiles/{body['user_id']}", json={
        "nama_lengkap": "Guru Profil Diperbarui", "nip": f"NIP-{suffix}",
        "email": f"guru.{suffix}@example.com", "no_hp": f"08{suffix}",
        "scopes": [{"pelajaran_id": pelajaran_id, "program_id": program_id, "kelas_id": None}],
    }, headers=admin_headers())
    assert update.status_code == 200
    assert update.json()["nama_lengkap"] == "Guru Profil Diperbarui"
    assert update.json()["scopes"][0]["kelas_id"] is None


def test_duplicate_profile_identity_rolls_back_account():
    program_id, kelas_id, pelajaran_id = refs()
    suffix = uuid4().hex[:8]
    base = {
        "password": "GuruDuplicate1", "nama_lengkap": "Guru Duplicate", "nip": f"DUP-{suffix}",
        "scopes": [{"pelajaran_id": pelajaran_id, "program_id": program_id, "kelas_id": kelas_id}],
    }
    first_username = f"guru-duplicate-one-{suffix}"
    second_username = f"guru-duplicate-two-{suffix}"
    first = client.post("/guru-scope/profiles", json={**base, "username": first_username}, headers=admin_headers())
    assert first.status_code == 200
    second = client.post("/guru-scope/profiles", json={**base, "username": second_username}, headers=admin_headers())
    assert second.status_code == 409
    db = SessionLocal()
    assert db.query(User).filter(User.username == second_username).first() is None
    db.close()
