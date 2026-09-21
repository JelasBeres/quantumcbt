import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.siswa import Siswa
from app.models.user import User

client = TestClient(app)


def student(username="profile-student", role="siswa", profile=True):
    with SessionLocal() as db:
        user = User(username=username, password_hash=get_password_hash("ProfileTest1"), role=role)
        db.add(user)
        db.flush()
        if profile:
            db.add(Siswa(user_id=user.id, nama_lengkap="Nama Lama", sekolah="Sekolah Lama", no_induk=username))
        db.commit()
    response = client.post("/auth/login", json={"username": username, "password": "ProfileTest1"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_update_own_profile_preserves_other_student_and_assignment():
    headers = student()
    other_headers = student("other-student")
    before = client.get("/siswa/profil", headers=headers).json()
    choices = [
        {"jurusan": "  Teknik Informatika  ", "universitas": "  Universitas Indonesia  "},
        {"jurusan": "Kedokteran", "universitas": "Universitas Gadjah Mada"},
        {"jurusan": "Arsitektur", "universitas": "Institut Teknologi Bandung"},
    ]
    response = client.patch("/siswa/profil", headers=headers, json={
        "nama_lengkap": "  Nama Baru  ", "sekolah": "  SMA Baru  ", "pilihan_jurusan": choices,
    })
    assert response.status_code == 200
    after = client.get("/siswa/profil", headers=headers).json()
    assert after["nama_lengkap"] == "Nama Baru"
    assert after["sekolah"] == "SMA Baru"
    assert after["pilihan_jurusan"] == [
        {"jurusan": "Teknik Informatika", "universitas": "Universitas Indonesia"},
        choices[1], choices[2],
    ]
    for key in ("id", "user_id", "no_induk", "program_id", "kelas_id"):
        assert after[key] == before[key]
    other = client.get("/siswa/profil", headers=other_headers).json()
    assert other["sekolah"] == "Sekolah Lama"
    assert other["pilihan_jurusan"] is None
    response = client.patch("/siswa/profil", headers=headers, json={"nama_lengkap": "Nama Baru"})
    assert response.json()["sekolah"] == "SMA Baru"
    assert response.json()["pilihan_jurusan"] == after["pilihan_jurusan"]
    response = client.patch("/siswa/profil", headers=headers, json={
        "nama_lengkap": "Nama Baru", "sekolah": "  ", "pilihan_jurusan": [],
    })
    assert response.json()["sekolah"] is None
    assert response.json()["pilihan_jurusan"] == []


@pytest.mark.parametrize("payload", [
    {"nama_lengkap": "  "}, {"nama_lengkap": "N" * 201},
    {"nama_lengkap": "Nama", "sekolah": "S" * 201},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [
        {"jurusan": str(index), "universitas": "Universitas"} for index in range(4)
    ]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "Teknik"}]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "", "universitas": "Universitas"}]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "Teknik", "universitas": "  "}]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "J" * 201, "universitas": "Universitas"}]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "Teknik", "universitas": "U" * 201}]},
    {"nama_lengkap": "Nama", "pilihan_jurusan": [{"jurusan": "Teknik", "universitas": "Universitas", "id": 1}]},
])
def test_profile_rejects_invalid_choices(payload):
    headers = student()
    assert client.patch("/siswa/profil", headers=headers, json=payload).status_code == 422
    profile = client.get("/siswa/profil", headers=headers).json()
    assert profile["nama_lengkap"] == "Nama Lama"
    assert profile["pilihan_jurusan"] is None


@pytest.mark.parametrize("field,value", [
    ("user_id", 999),
    ("program_id", 999),
    ("kelas_id", 999),
    ("no_induk", "changed"),
])
def test_profile_rejects_protected_fields(field, value):
    headers = student()
    before = client.get("/siswa/profil", headers=headers).json()
    payload = {
        "nama_lengkap": "Nama Baru",
        "pilihan_jurusan": [{"jurusan": "Teknik", "universitas": "Universitas"}],
        field: value,
    }
    assert client.patch("/siswa/profil", headers=headers, json=payload).status_code == 422
    assert client.get("/siswa/profil", headers=headers).json() == before


def test_profile_access_requires_student_with_profile():
    assert client.get("/siswa/profil").status_code == 401
    for role in ("guru", "admin"):
        headers = student(role, role=role)
        assert client.get("/siswa/profil", headers=headers).status_code == 403
        assert client.patch("/siswa/profil", headers=headers, json={"nama_lengkap": "Nama"}).status_code == 403
    headers = student("missing-profile", profile=False)
    assert client.get("/siswa/profil", headers=headers).status_code == 404


def test_legacy_admin_update_preserves_school_when_omitted():
    student_headers = student()
    admin_headers = student("admin", role="admin", profile=False)
    current = client.get("/siswa/profil", headers=student_headers).json()
    payload = {key: current[key] for key in ("user_id", "nama_lengkap", "no_induk", "program_id", "kelas_id")}
    response = client.put(f"/siswa/{current['id']}", headers=admin_headers, json=payload)
    assert response.status_code == 200
    assert response.json()["sekolah"] == "Sekolah Lama"


def test_school_migration_preserves_existing_rows():
    migration_path = Path(__file__).parents[1] / "alembic/versions/h8c9d0e1f2a3_add_siswa_sekolah.py"
    spec = importlib.util.spec_from_file_location("school_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE siswa (id INTEGER PRIMARY KEY, nama_lengkap VARCHAR(200) NOT NULL)"))
        connection.execute(text("INSERT INTO siswa VALUES (1, 'Existing student')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(text("SELECT sekolah FROM siswa")).scalar() is None
            migration.downgrade()
        assert "sekolah" not in {c["name"] for c in inspect(connection).get_columns("siswa")}
        assert connection.execute(text("SELECT nama_lengkap FROM siswa")).scalar() == "Existing student"
    engine.dispose()
