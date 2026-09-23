from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.siswa import Siswa
from app.models.paket_ujian import PaketUjian
from app.models.paket_soal import PaketSoal
from app.models.soal import Soal
from app.models.bagian_paket import BagianPaket
from app.models.ujian_siswa import UjianSiswa
from support import active_schedule_id, default_program_id

client = TestClient(app)


def setup_exam(tipe="latihan", sections=False):
    program = default_program_id()
    with SessionLocal() as db:
        user = User(username="newflow", password_hash=get_password_hash("Newflow123"), role="siswa")
        db.add(user); db.flush()
        siswa = Siswa(user_id=user.id, nama_lengkap="New Flow", program_id=program)
        paket = PaketUjian(nama="Practice", tipe=tipe, durasi_menit=30, program_id=program, is_random_soal=False)
        db.add_all([siswa, paket]); db.flush()
        ids = []
        for i in range(2):
            soal = Soal(teks_soal=f"Question {i}", tipe="esai", status="approved")
            db.add(soal); db.flush(); ids.append(soal.id)
            bagian_id = None
            if sections:
                bagian = BagianPaket(paket_ujian_id=paket.id, nama=f"Subject {i}", urutan=i+1)
                db.add(bagian); db.flush(); bagian_id = bagian.id
            db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal.id, urutan=i+1, bagian_paket_id=bagian_id))
        paket.jumlah_soal = 2
        db.commit(); paket_id = paket.id
    token = client.post("/auth/login", json={"username": "newflow", "password": "Newflow123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, paket_id, ids


def test_practice_anytime_repeat_resume_and_no_history():
    headers, paket, _ = setup_exam()
    assert client.get("/siswa/latihan", headers=headers).json()[0]["id"] == paket
    payload = {"paket_ujian_id": paket, "mode": "latihan"}
    response = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    first = response.json()["ujian_siswa_id"]
    assert response.json()["jadwal_ujian_id"] is None
    assert client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload).json()["ujian_siswa_id"] == first
    assert client.patch(f"/ujian-siswa/{first}/submit", headers=headers).status_code == 200
    assert client.get("/siswa/riwayat-ujian", headers=headers).json() == []
    second = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload)
    assert second.status_code == 200
    assert second.json()["ujian_siswa_id"] != first
    assert client.post("/ujian-siswa/mulai-latihan", headers=headers, json={**payload, "mode": "drill"}).status_code == 200
    with SessionLocal() as db:
        item = db.get(PaketUjian, paket); item.program_id = 999; db.commit()
    assert client.get("/siswa/latihan", headers=headers).json() == []
    assert client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload).status_code == 403


def test_tryout_sections_are_locked_sequentially():
    """Tryout dengan bagian mengunci navigasi per-bagian: soal bagian
    berikutnya baru terbuka setelah lanjut-bagian, dan bagian yang sudah
    dilewati tidak bisa diakses lagi."""
    headers, paket, ids = setup_exam("ujian", sections=True)
    jadwal = active_schedule_id(paket)
    response = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal})
    assert response.status_code == 200, response.text
    attempt = response.json()["ujian_siswa_id"]
    state = client.get(f"/ujian-siswa/{attempt}/state", headers=headers).json()
    assert state["soal_aktif_ids"] == [ids[0]]
    assert client.get(f"/ujian-siswa/{attempt}/soal/2", headers=headers).status_code == 409
    assert client.post(f"/ujian-siswa/{attempt}/jawab", headers=headers, json={"soal_id": ids[1], "jawaban_teks": "no"}).status_code == 409
    result = client.post(f"/ujian-siswa/{attempt}/lanjut-bagian?bagian_aktif=0", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["soal_aktif_ids"] == [ids[1]]
    assert client.get(f"/ujian-siswa/{attempt}/soal/1", headers=headers).status_code == 409
    assert client.get(f"/ujian-siswa/{attempt}/soal/2", headers=headers).status_code == 200
    assert client.post(f"/ujian-siswa/{attempt}/lanjut-bagian?bagian_aktif=1", headers=headers).status_code == 409
    assert client.patch(f"/ujian-siswa/{attempt}/submit", headers=headers).status_code == 200
    assert len(client.get("/siswa/riwayat-ujian", headers=headers).json()) == 1
    assert client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal}).status_code == 400


def test_speedtest_schema_removed():
    from pydantic import ValidationError
    from app.schemas.paket_ujian import PaketUjianCreate, PaketUjianUpdate
    import pytest
    for schema in (PaketUjianCreate, PaketUjianUpdate):
        with pytest.raises(ValidationError):
            schema(nama="Old mode", program_id=1, tipe="speedtest")


def test_retired_type_cannot_be_reactivated_or_cloned():
    with SessionLocal() as db:
        admin = User(username="retire-admin", password_hash=get_password_hash("RetireAdmin1"), role="admin")
        paket = PaketUjian(nama="Legacy", tipe="speedtest", is_archived=True)
        db.add_all([admin, paket]); db.commit(); paket_id = paket.id
    token = client.post("/auth/login", json={"username": "retire-admin", "password": "RetireAdmin1"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/paket-ujian/", headers=h).json() == []
    assert client.post(f"/paket-ujian/{paket_id}/unarchive", headers=h).status_code == 409
    assert client.post(f"/paket-ujian/{paket_id}/clone", headers=h, json={}).status_code == 409


def test_admin_sets_major_student_can_change_own_choices_only_through_profile():
    with SessionLocal() as db:
        admin = User(username="major-admin", password_hash=get_password_hash("MajorAdmin1"), role="admin")
        db.add(admin); db.commit()
    token = client.post("/auth/login", json={"username": "major-admin", "password": "MajorAdmin1"}).json()["access_token"]
    admin_h = {"Authorization": f"Bearer {token}"}
    choices = [{"jurusan": "Matematika", "universitas": "Universitas Contoh"}]
    created = client.post("/siswa/register", headers=admin_h, json={"nama_lengkap": "Student", "username": "major-student", "password": "MajorStudent1", "pilihan_jurusan": choices})
    assert created.status_code == 200, created.text
    assert created.json()["pilihan_jurusan"] == choices
    token = client.post("/auth/login", json={"username": "major-student", "password": "MajorStudent1"}).json()["access_token"]
    student_h = {"Authorization": f"Bearer {token}"}
    assert client.get("/siswa/profil", headers=student_h).json()["pilihan_jurusan"] == choices
    updated = client.patch("/siswa/profil", headers=student_h, json={"nama_lengkap": "Student", "pilihan_jurusan": []})
    assert updated.status_code == 200
    assert updated.json()["pilihan_jurusan"] == []
    payload = {"user_id": created.json()["user_id"], "nama_lengkap": "Student", "pilihan_jurusan": choices}
    assert client.put(f"/siswa/{created.json()['id']}", headers=student_h, json=payload).status_code == 403
    assert client.put(f"/siswa/{created.json()['id']}", headers=admin_h, json=payload).json()["pilihan_jurusan"] == choices


def test_migrations_preserve_legacy_attempts_and_archive_speedtest():
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE paket_ujian (id INTEGER PRIMARY KEY, tipe TEXT, is_archived BOOLEAN)"))
        conn.execute(text("INSERT INTO paket_ujian VALUES (1, 'speedtest', false), (2, 'ujian', false)"))
        conn.execute(text("CREATE TABLE ujian_siswa (id INTEGER PRIMARY KEY)"))
        conn.execute(text("INSERT INTO ujian_siswa VALUES (9)"))
        conn.execute(text("CREATE TABLE siswa (id INTEGER PRIMARY KEY)"))
        for filename in ("j0e1f2a3b4c5_retire_speedtest.py", "k1f2a3b4c5d6_practice_and_sections.py"):
            path = Path(__file__).parents[1] / "alembic" / "versions" / filename
            spec = importlib.util.spec_from_file_location(filename, path)
            migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
        assert conn.execute(text("SELECT is_archived FROM paket_ujian ORDER BY id")).scalars().all() == [1, 0]
        assert conn.execute(text("SELECT id, bagian_aktif, mode_latihan FROM ujian_siswa")).one() == (9, 0, None)
    engine.dispose()
