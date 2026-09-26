from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.kelas import Kelas
from app.models.program import Program
from app.models.siswa import Siswa
from app.models.user import User
from test_soal_review_workflow import ensure_user, headers

client = TestClient(app)


def _setup():
    ensure_user("imp-admin", "ImpAdmin1", "admin")
    with SessionLocal() as db:
        if not db.query(Program).filter(Program.nama == "Program Impor").first():
            db.add(Program(nama="Program Impor"))
        if not db.query(Kelas).filter(Kelas.nama == "Kelas Impor").first():
            db.add(Kelas(nama="Kelas Impor"))
        existing = db.query(User).filter(User.username == "imp-lama").first()
        if not existing:
            existing = User(username="imp-lama", password_hash="x", role="siswa")
            db.add(existing)
            db.flush()
            db.add(Siswa(user_id=existing.id, nama_lengkap="Siswa Lama", no_induk="IMP-LAMA"))
        db.commit()
    return headers("imp-admin", "ImpAdmin1")


CSV = (
    "nama_lengkap;username;password;no_induk;sekolah;program;kelas;jurusan_1;universitas_1\n"
    "Budi Baru;imp-budi;rahasia1;IMP-001;SMA 1;program impor;Kelas Impor;Kedokteran;UI\n"
    "Siswa Lama Lagi;IMP-LAMA;rahasia1;IMP-002;;Program Impor;;;\n"
    "Nomor Induk Lama;imp-ani;rahasia1;IMP-LAMA;;Program Impor;;;\n"
    "Dobel Username;imp-budi;rahasia1;IMP-003;;Program Impor;;;\n"
    "Program Salah;imp-cici;rahasia1;IMP-004;;Program Entah;;;\n"
    "Tanpa Password;imp-dedi;;IMP-005;;Program Impor;;;\n"
).encode("utf-8")


def _file(content=CSV, name="siswa.csv"):
    return {"file": (name, content, "text/csv")}


def test_preview_tidak_menyimpan_dan_menandai_duplikat():
    admin_h = _setup()
    res = client.post("/siswa/import/preview", headers=admin_h, files=_file())
    assert res.status_code == 200, res.text
    body = res.json()
    status = {row["baris"]: row["status"] for row in body["baris"]}
    assert status == {2: "siap", 3: "dilewati", 4: "dilewati", 5: "error", 6: "error", 7: "error"}
    assert (body["siap"], body["dilewati"], body["error"]) == (1, 2, 3)
    assert all("_password" not in row and "password" not in row for row in body["baris"])
    with SessionLocal() as db:
        assert not db.query(User).filter(User.username == "imp-budi").first()


def test_import_hanya_menyimpan_baris_siap_dan_aman_diulang():
    admin_h = _setup()
    res = client.post("/siswa/import", headers=admin_h, files=_file())
    assert res.status_code == 200, res.text
    assert res.json()["berhasil"] == 1
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "imp-budi").one()
        siswa = db.query(Siswa).filter(Siswa.user_id == user.id).one()
        assert user.role == "siswa"
        assert siswa.no_induk == "IMP-001" and siswa.program_id is not None and siswa.kelas_id is not None
        assert siswa.pilihan_jurusan == [{"jurusan": "Kedokteran", "universitas": "UI"}]
        lama = db.query(Siswa).filter(Siswa.no_induk == "IMP-LAMA").one()
        assert lama.nama_lengkap == "Siswa Lama"  # data lama tidak ditimpa

    # Upload file yang sama lagi: tidak ada siswa ganda.
    ulang = client.post("/siswa/import", headers=admin_h, files=_file())
    assert ulang.json()["berhasil"] == 0
    with SessionLocal() as db:
        assert db.query(User).filter(User.username == "imp-budi").count() == 1


def test_file_tidak_valid_ditolak():
    admin_h = _setup()
    assert client.post("/siswa/import/preview", headers=admin_h, files=_file(b"nama,kelas\nA,B\n")).status_code == 400
    assert client.post("/siswa/import/preview", headers=admin_h, files=_file(CSV, "siswa.xlsx")).status_code == 400
    ensure_user("imp-siswa", "ImpSiswa1", "siswa")
    siswa_h = headers("imp-siswa", "ImpSiswa1")
    assert client.post("/siswa/import/preview", headers=siswa_h, files=_file()).status_code == 403
