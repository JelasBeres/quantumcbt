from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.kategori_paket import KategoriPaket
from app.models.paket_ujian import PaketUjian
from app.models.program import Program
from app.models.user import User
from app.routers.kategori_paket import seed_kategori_paket

client = TestClient(app)


def setup_users():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        admin = User(username=f"kat-admin-{suffix}", password_hash=get_password_hash("Admin123"), role="admin")
        guru = User(username=f"kat-guru-{suffix}", password_hash=get_password_hash("Guru123"), role="guru")
        program = Program(nama=f"Program {suffix}", is_active=True)
        db.add_all([admin, guru, program])
        db.commit()
        return admin.username, guru.username, program.id


def headers(username, password):
    response = client.post("/auth/login", json={"username": username, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_seed_backfill_is_idempotent(isolated_database):
    with SessionLocal() as db:
        program = Program(nama="Backfill", is_active=True)
        db.add(program)
        db.flush()
        package = PaketUjian(nama="Legacy", program_id=program.id, kategori="utbk")
        db.add(package)
        db.commit()
        seed_kategori_paket(db)
        seed_kategori_paket(db)
        db.refresh(package)
        assert db.query(KategoriPaket).count() == 3
        assert package.kategori_id == db.query(KategoriPaket).filter(KategoriPaket.kode == "utbk").one().id


def test_crud_auth_duplicates_applicability_and_reference(isolated_database):
    admin_name, guru_name, program_id = setup_users()
    admin = headers(admin_name, "Admin123")
    guru = headers(guru_name, "Guru123")
    assert client.get("/kategori-paket/", headers=guru).status_code == 200
    payload = {"kode": "simulasi", "nama": "Simulasi", "tipe": "ujian", "is_active": True}
    assert client.post("/kategori-paket/", json=payload, headers=guru).status_code == 403
    created = client.post("/kategori-paket/", json=payload, headers=admin)
    assert created.status_code == 200
    category_id = created.json()["id"]
    assert client.post("/kategori-paket/", json={**payload, "nama": "Lain"}, headers=admin).status_code == 409
    assert client.post("/kategori-paket/", json={**payload, "kode": "lain", "nama": "Simulasi"}, headers=admin).status_code == 409
    assert client.post("/kategori-paket/", json={**payload, "kode": "invalid", "nama": "Invalid", "tipe": "bebas"}, headers=admin).status_code == 422
    invalid_type = client.post("/paket-ujian/", json={"nama": "Latihan", "program_id": program_id, "tipe": "latihan", "kategori_id": category_id}, headers=admin)
    assert invalid_type.status_code == 400
    package = client.post("/paket-ujian/", json={"nama": "Ujian", "program_id": program_id, "tipe": "ujian", "kategori_id": category_id}, headers=admin)
    assert package.status_code == 200
    assert package.json()["kategori"] == "simulasi"
    assert package.json()["kategori_nama"] == "Simulasi"
    assert client.delete(f"/kategori-paket/{category_id}", headers=admin).status_code == 409


def test_package_legacy_code_and_grouping_data(isolated_database):
    admin_name, _, program_id = setup_users()
    admin = headers(admin_name, "Admin123")
    by_code = client.post("/paket-ujian/", json={"nama": "Legacy client", "program_id": program_id, "kategori": "tka_sma"}, headers=admin)
    assert by_code.status_code == 200
    assert by_code.json()["kategori_id"] is not None
    categories = client.get("/kategori-paket/", headers=admin).json()
    tka = next(item for item in categories if item["kode"] == "tka_sma")
    assert tka["jumlah_paket"] == 1
    listed = client.get("/paket-ujian/", headers=admin).json()
    item = next(row for row in listed if row["id"] == by_code.json()["id"])
    assert item["kategori_id"] == tka["id"]
