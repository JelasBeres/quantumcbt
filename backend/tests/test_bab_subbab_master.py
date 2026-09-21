import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.pelajaran import Pelajaran
from app.models.user import User

client = TestClient(app)


def setup_users_and_subjects():
    with SessionLocal() as db:
        admin = User(username="master-admin", password_hash=get_password_hash("MasterTest1"), role="admin")
        guru = User(username="master-guru", password_hash=get_password_hash("MasterTest1"), role="guru")
        siswa = User(username="master-siswa", password_hash=get_password_hash("MasterTest1"), role="siswa")
        matematika = Pelajaran(nama="Matematika")
        fisika = Pelajaran(nama="Fisika")
        db.add_all([admin, guru, siswa, matematika, fisika])
        db.commit()
        subject_ids = matematika.id, fisika.id
    headers = {}
    for username in ("master-admin", "master-guru", "master-siswa"):
        response = client.post("/auth/login", json={"username": username, "password": "MasterTest1"})
        assert response.status_code == 200
        headers[username] = {"Authorization": "Bearer " + response.json()["access_token"]}
    return headers, subject_ids


def test_bab_and_subbab_crud_auth_duplicates_and_filters():
    headers, (matematika, fisika) = setup_users_and_subjects()
    admin = headers["master-admin"]
    guru = headers["master-guru"]
    siswa = headers["master-siswa"]

    assert client.get("/topik/").status_code == 401
    assert client.get("/subbab/").status_code == 401
    assert client.get("/topik/", headers=guru).status_code == 200
    assert client.post("/topik/", headers=guru, json={"pelajaran_id": matematika, "nama": "Aljabar", "is_active": True}).status_code == 403
    assert client.post("/subbab/", headers=guru, json={"topik_id": 1, "nama": "Persamaan", "is_active": True}).status_code == 403
    assert client.post("/topik/", headers=siswa, json={"pelajaran_id": matematika, "nama": "Aljabar", "is_active": True}).status_code == 403

    response = client.post("/topik/", headers=admin, json={"pelajaran_id": matematika, "nama": "  Aljabar  ", "is_active": True})
    assert response.status_code == 200
    bab_id = response.json()["id"]
    assert response.json()["nama"] == "Aljabar"
    assert client.post("/topik/", headers=admin, json={"pelajaran_id": matematika, "nama": "alJABar", "is_active": True}).status_code == 409
    assert client.post("/topik/", headers=admin, json={"pelajaran_id": 999999, "nama": "Tidak Ada", "is_active": True}).status_code == 404
    assert client.post("/topik/", headers=admin, json={"pelajaran_id": fisika, "nama": "Aljabar", "is_active": True}).status_code == 200

    response = client.post("/subbab/", headers=admin, json={"topik_id": bab_id, "nama": "  Persamaan Linear  ", "is_active": True})
    assert response.status_code == 200
    subbab_id = response.json()["id"]
    assert response.json()["pelajaran_id"] == matematika
    assert client.post("/subbab/", headers=admin, json={"topik_id": bab_id, "nama": "persamaan LINEAR", "is_active": True}).status_code == 409
    assert client.post("/subbab/", headers=admin, json={"topik_id": 999999, "nama": "Invalid", "is_active": True}).status_code == 404
    assert [row["id"] for row in client.get("/subbab/", headers=guru, params={"topik_id": bab_id}).json()] == [subbab_id]
    assert [row["id"] for row in client.get("/subbab/", headers=guru, params={"pelajaran_id": matematika}).json()] == [subbab_id]

    response = client.put(f"/subbab/{subbab_id}", headers=admin, json={"topik_id": bab_id, "nama": "Persamaan", "is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert client.delete(f"/subbab/{subbab_id}", headers=admin).status_code == 200
    assert client.delete(f"/topik/{bab_id}", headers=admin).status_code == 200


def test_question_master_link_legacy_matching_mismatch_delete_protection_and_revision():
    headers, (matematika, fisika) = setup_users_and_subjects()
    admin = headers["master-admin"]
    bab = client.post("/topik/", headers=admin, json={"pelajaran_id": matematika, "nama": "Aljabar", "is_active": True}).json()
    other_bab = client.post("/topik/", headers=admin, json={"pelajaran_id": fisika, "nama": "Mekanika", "is_active": True}).json()
    subbab = client.post("/subbab/", headers=admin, json={"topik_id": bab["id"], "nama": "Persamaan Linear", "is_active": True}).json()

    base = {"pelajaran_id": matematika, "topik_id": bab["id"], "teks_soal": "Tentukan nilai x", "tipe": "esai"}
    response = client.post("/soal/", headers=admin, json={**base, "subbab_id": subbab["id"], "subbab": "teks klien diabaikan"})
    assert response.status_code == 200
    soal_id = response.json()["id"]
    assert response.json()["subbab_id"] == subbab["id"]
    assert response.json()["subbab"] == "Persamaan Linear"

    legacy_match = client.post("/soal/", headers=admin, json={**base, "teks_soal": "Legacy cocok", "subbab": "persamaan linear"})
    assert legacy_match.status_code == 200
    assert legacy_match.json()["subbab_id"] == subbab["id"]
    assert legacy_match.json()["subbab"] == "Persamaan Linear"

    legacy = client.post("/soal/", headers=admin, json={**base, "teks_soal": "Legacy bebas", "subbab": "Materi lama"})
    assert legacy.status_code == 200
    assert legacy.json()["subbab_id"] is None
    assert legacy.json()["subbab"] == "Materi lama"

    mismatch = client.post("/soal/", headers=admin, json={**base, "topik_id": other_bab["id"], "subbab_id": subbab["id"]})
    assert mismatch.status_code == 400
    assert client.get("/soal/", headers=admin, params={"subbab_id": subbab["id"]}).json()[0]["id"] in {soal_id, legacy_match.json()["id"]}
    assert client.delete(f"/subbab/{subbab['id']}", headers=admin).status_code == 409
    assert client.delete(f"/topik/{bab['id']}", headers=admin).status_code == 409

    revision = client.post(f"/soal/{soal_id}/revision", headers=admin)
    assert revision.status_code == 200
    assert revision.json()["subbab_id"] == subbab["id"]
    assert revision.json()["subbab"] == "Persamaan Linear"

    update_payload = {**base, "topik_id": other_bab["id"], "pelajaran_id": fisika, "teks_soal": "Dipindah"}
    updated = client.put(f"/soal/{soal_id}", headers=admin, json=update_payload)
    assert updated.status_code == 200
    assert updated.json()["subbab_id"] is None
    assert updated.json()["subbab"] is None


def test_master_migration_preserves_legacy_question_rows():
    path = Path(__file__).parents[1] / "alembic/versions/q6e7f8g9h0i1_add_bab_subbab_master.py"
    spec = importlib.util.spec_from_file_location("bab_subbab_master_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE pelajaran (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE topik (id INTEGER PRIMARY KEY, pelajaran_id INTEGER NOT NULL, nama VARCHAR(150) NOT NULL, is_active BOOLEAN)"))
        connection.execute(text("CREATE INDEX ix_topik_pelajaran_id ON topik (pelajaran_id)"))
        connection.execute(text("CREATE TABLE soal (id INTEGER PRIMARY KEY, topik_id INTEGER, subbab VARCHAR(150), teks_soal TEXT NOT NULL)"))
        connection.execute(text("INSERT INTO pelajaran VALUES (1)"))
        connection.execute(text("INSERT INTO topik VALUES (1, 1, 'Aljabar', 1)"))
        connection.execute(text("INSERT INTO soal VALUES (1, 1, 'Materi lama', 'Existing question')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        row = connection.execute(text("SELECT subbab_id, subbab, teks_soal FROM soal WHERE id = 1")).one()
        assert tuple(row) == (None, "Materi lama", "Existing question")
        assert "subbab" in inspect(connection).get_table_names()
        assert "subbab_id" in {column["name"] for column in inspect(connection).get_columns("soal")}
    engine.dispose()
