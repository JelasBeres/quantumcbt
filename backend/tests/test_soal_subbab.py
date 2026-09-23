from fastapi.testclient import TestClient
import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.pelajaran import Pelajaran
from app.models.topik import Topik
from app.models.user import User

client = TestClient(app)


def create_reference_data():
    with SessionLocal() as db:
        admin = User(username="subbab-admin", password_hash=get_password_hash("SubbabTest1"), role="admin")
        guru = User(username="subbab-guru", password_hash=get_password_hash("SubbabTest1"), role="guru")
        subject = Pelajaran(nama="Matematika")
        other = Pelajaran(nama="Fisika")
        db.add_all([admin, guru, subject, other])
        db.flush()
        chapter = Topik(pelajaran_id=subject.id, nama="Aljabar")
        another = Topik(pelajaran_id=subject.id, nama="Geometri")
        wrong = Topik(pelajaran_id=other.id, nama="Gerak")
        db.add_all([chapter, another, wrong, GuruScope(user_id=guru.id, pelajaran_id=subject.id)])
        db.commit()
        ids = subject.id, chapter.id, another.id, wrong.id
    headers = []
    for username in ("subbab-admin", "subbab-guru"):
        response = client.post("/auth/login", json={"username": username, "password": "SubbabTest1"})
        assert response.status_code == 200
        headers.append({"Authorization": "Bearer " + response.json()["access_token"]})
    return *headers, ids


def test_subbab_roundtrip_filter_generate_and_revision():
    admin, guru, (subject, chapter, _, _) = create_reference_data()
    payload = {"pelajaran_id": subject, "topik_id": chapter, "subbab": "  Persamaan  ",
               "teks_soal": "Tentukan x", "tipe": "esai", "tingkat_kesulitan": "mudah"}
    response = client.post("/soal/", headers=admin, json=payload)
    assert response.status_code == 200
    soal_id = response.json()["id"]
    assert response.json()["subbab"] == "Persamaan"
    assert client.get(f"/soal/{soal_id}", headers=admin).json()["subbab"] == "Persamaan"
    assert client.post("/soal/", headers=admin, json={**payload, "subbab": "Pertidaksamaan"}).status_code == 200
    assert client.post("/soal/", headers=guru, json=payload).status_code == 200  # draft is not a candidate
    filtered = client.get("/soal/", headers=admin, params={"subbab": "Pertidaksamaan", "topik_id": chapter})
    assert len(filtered.json()) == 1
    response = client.post("/soal/generate-kandidat", headers=admin, json={
        "pelajaran_id": subject, "topik_id": chapter, "subbab": "Persamaan", "tipe": "esai", "kesulitan": "mudah", "jumlah": 5})
    assert response.status_code == 200
    assert response.json()["available"] == 1
    assert response.json()["items"][0]["id"] == soal_id
    assert client.post(f"/soal/{soal_id}/revision", headers=admin).json()["subbab"] == "Persamaan"


def test_subbab_requires_matching_chapter_and_subject():
    admin, _, (subject, chapter, _, wrong) = create_reference_data()
    base = {"teks_soal": "Soal", "pelajaran_id": subject, "subbab": "Subbab"}
    assert client.post("/soal/", headers=admin, json=base).status_code == 400
    assert client.post("/soal/", headers=admin, json={**base, "topik_id": wrong}).status_code == 400
    assert client.post("/soal/", headers=admin, json={**base, "topik_id": chapter, "subbab": "x" * 151}).status_code == 422
    assert client.post("/soal/", headers=admin, json={"teks_soal": "Legacy question"}).status_code == 200


def test_draft_and_rejected_edit_preserve_or_clear_subbab():
    admin, guru, (subject, chapter, another, _) = create_reference_data()
    payload = {"pelajaran_id": subject, "topik_id": chapter, "subbab": "Persamaan", "teks_soal": "Awal", "tipe": "esai"}
    created = client.post("/soal/", headers=guru, json=payload)
    assert created.status_code == 200
    soal_id = created.json()["id"]
    legacy = {key: value for key, value in payload.items() if key != "subbab"}
    response = client.put(f"/soal/{soal_id}", headers=guru, json={**legacy, "teks_soal": "Diedit"})
    assert response.status_code == 200
    assert response.json()["subbab"] == "Persamaan"
    assert client.post(f"/soal/{soal_id}/submit-review", headers=guru, json={}).status_code == 200
    assert client.put(f"/soal/{soal_id}", headers=guru, json=payload).status_code == 409
    assert client.post(f"/soal/{soal_id}/reject", headers=admin, json={"note": "Perbaiki isi"}).status_code == 200
    response = client.put(f"/soal/{soal_id}", headers=guru, json={**payload, "subbab": "Persamaan linear"})
    assert response.status_code == 200
    assert response.json()["status"] == "draft"
    assert response.json()["subbab"] == "Persamaan linear"
    response = client.put(f"/soal/{soal_id}", headers=guru, json={**legacy, "topik_id": another})
    assert response.status_code == 200
    assert response.json()["subbab"] is None


def test_subbab_migration_preserves_question_rows():
    path = Path(__file__).parents[1] / "alembic/versions/i9d0e1f2a3b4_add_soal_subbab.py"
    spec = importlib.util.spec_from_file_location("subbab_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE soal (id INTEGER PRIMARY KEY, teks_soal TEXT NOT NULL)"))
        connection.execute(text("INSERT INTO soal VALUES (1, 'Existing question')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(text("SELECT subbab FROM soal")).scalar() is None
            assert "ix_soal_subbab" in {i["name"] for i in inspect(connection).get_indexes("soal")}
            migration.downgrade()
        assert "subbab" not in {c["name"] for c in inspect(connection).get_columns("soal")}
        assert connection.execute(text("SELECT teks_soal FROM soal")).scalar() == "Existing question"
    engine.dispose()
