"""Revisi client tahap 2: reset pengerjaan tryout oleh admin, daftar pengajuan
di dashboard admin, dan drilling tidak masuk riwayat."""

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.hasil_ujian import HasilUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from support import active_schedule_id
from test_client_september17 import setup_exam

client = TestClient(app)


def _admin_headers(username: str):
    with SessionLocal() as db:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(username=username, password_hash=get_password_hash("Admin12345"), role="admin"))
            db.commit()
    token = client.post("/auth/login", json={"username": username, "password": "Admin12345"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_reset_pengerjaan_tryout_siswa_bisa_mengerjakan_ulang():
    headers, paket, soal_ids = setup_exam(tipe="ujian")
    jadwal_id = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id})
    assert ujian.status_code == 200, ujian.text
    ujian_id = ujian.json()["ujian_siswa_id"]
    assert client.patch(f"/ujian-siswa/{ujian_id}/submit", headers=headers).status_code == 200
    ulang = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id})
    assert ulang.status_code == 400

    # Siswa tidak boleh mereset sendiri.
    assert client.delete(f"/ujian-siswa/{ujian_id}/reset", headers=headers).status_code == 403

    admin = _admin_headers("reset-admin")
    reset = client.delete(f"/ujian-siswa/{ujian_id}/reset", headers=admin)
    assert reset.status_code == 200, reset.text
    assert reset.json()["jadwal_berakhir"] is False
    with SessionLocal() as db:
        assert db.get(UjianSiswa, ujian_id) is None
        assert db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian_id).count() == 0
        assert db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian_id).count() == 0

    baru = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id})
    assert baru.status_code == 200, baru.text
    with SessionLocal() as db:
        assert db.get(UjianSiswa, baru.json()["ujian_siswa_id"]).is_submitted is False


def test_dashboard_perlu_tindakan_berisi_pengajuan_soal():
    admin = _admin_headers("tindakan-admin")
    with SessionLocal() as db:
        db.add(Soal(teks_soal="<p>Soal pengajuan</p>", tipe="esai", status="pending_review"))
        db.commit()
    res = client.get("/dashboard/perlu-tindakan", headers=admin)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["soal_pending"] >= 1
    soal_items = [item for item in data["items"] if item["jenis"] == "soal"]
    assert soal_items and all(item["href"] == "/admin/review-soal" for item in soal_items)


def test_ekspor_set_soal_berisi_soal_kunci_pembahasan():
    from app.models.bagian_paket import BagianPaket

    headers, paket, _ = setup_exam(tipe="ujian", sections=True)
    with SessionLocal() as db:
        bagian_id = db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket).order_by(BagianPaket.urutan).first()[0]
    # Siswa tidak boleh mengekspor.
    assert client.get(f"/paket-ujian/{paket}/bagian/{bagian_id}/ekspor", headers=headers).status_code == 403
    admin = _admin_headers("ekspor-admin")
    res = client.get(f"/paket-ujian/{paket}/bagian/{bagian_id}/ekspor", headers=admin)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["soal"] and data["soal"][0]["nomor"] == 1
    assert {"teks_soal", "opsi", "pernyataan", "kunci_jawaban", "pembahasan"} <= set(data["soal"][0])
    assert {"kategori_nama", "kelas_nama", "pelajaran_nama", "bagian_nama"} <= set(data)


def test_kkm_paket_disimpan_dan_dipakai_rekap_nilai():
    from app.models.program import Program

    headers = _admin_headers("admin-kkm-paket")
    with SessionLocal() as db:
        program = Program(nama="Program KKM", is_active=True)
        db.add(program)
        db.commit()
        program_id = program.id

    dibuat = client.post("/paket-ujian/", headers=headers, json={"nama": "Paket KKM", "program_id": program_id, "kategori": "utbk", "kkm": 60})
    assert dibuat.status_code == 200, dibuat.text
    paket = dibuat.json()
    assert paket["kkm"] == 60

    payload = {"nama": paket["nama"], "program_id": program_id, "kkm": 82.5}
    diubah = client.put(f"/paket-ujian/{paket['id']}", headers=headers, json=payload)
    assert diubah.status_code == 200, diubah.text
    assert diubah.json()["kkm"] == 82.5

    # Tanpa kkm di payload: nilai lama tetap; di luar 0-100 ditolak.
    tetap = client.put(f"/paket-ujian/{paket['id']}", headers=headers, json={"nama": paket["nama"], "program_id": program_id})
    assert tetap.json()["kkm"] == 82.5
    assert client.put(f"/paket-ujian/{paket['id']}", headers=headers, json={**payload, "kkm": 101}).status_code == 422

    default = client.post("/paket-ujian/", headers=headers, json={"nama": "Paket KKM Default", "program_id": program_id, "kategori": "utbk"})
    assert default.json()["kkm"] == 75


def test_rekap_nilai_membawa_kkm_paket():
    from app.models.paket_ujian import PaketUjian

    headers, paket, _ = setup_exam(tipe="ujian")
    jadwal_id = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id}).json()
    assert client.patch(f"/ujian-siswa/{ujian['ujian_siswa_id']}/submit", headers=headers).status_code == 200
    with SessionLocal() as db:
        paket_id = db.get(UjianSiswa, ujian["ujian_siswa_id"]).paket_ujian_id
        db.get(PaketUjian, paket_id).kkm = 55
        db.commit()
    admin = _admin_headers("admin-kkm-rekap")
    rows = client.get("/dashboard/hasil-siswa", headers=admin, params={"paket_ujian_id": paket_id}).json()
    assert rows and all(row["kkm"] == 55 for row in rows)


def test_hanya_siswa_pemilik_yang_bisa_menyimpan_jawaban():
    headers, paket, soal_ids = setup_exam(tipe="ujian")
    jadwal_id = active_schedule_id(paket)
    ujian_id = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id}).json()["ujian_siswa_id"]
    admin = _admin_headers("admin-tidak-boleh-menjawab")
    soal_id = client.get(f"/ujian-siswa/{ujian_id}/state", headers=headers).json()["soal_aktif_ids"][0]
    # Admin/guru tidak boleh mengubah jawaban atau tanda ragu siswa.
    assert client.post(f"/ujian-siswa/{ujian_id}/jawab", headers=admin, json={"soal_id": soal_id, "jawaban_teks": "x"}).status_code == 403
    assert client.patch(f"/ujian-siswa/{ujian_id}/ragu", headers=admin, json={"soal_id": soal_id, "is_ragu": True}).status_code == 403
    assert client.patch(f"/ujian-siswa/{ujian_id}/ragu", headers=headers, json={"soal_id": soal_id, "is_ragu": True}).status_code == 200


def test_login_username_tidak_membedakan_huruf_besar_kecil():
    with SessionLocal() as db:
        db.add(User(username="budi.kapital", password_hash=get_password_hash("Siswa12345"), role="siswa"))
        db.commit()
    # Keyboard HP mengkapitalkan huruf pertama; tetap bisa login.
    assert client.post("/auth/login", json={"username": "Budi.Kapital", "password": "Siswa12345"}).status_code == 200
    assert client.post("/auth/login", json={"username": "Budi.Kapital", "password": "salah"}).status_code == 401
    # Username yang hanya beda huruf besar/kecil ditolak saat membuat akun baru.
    admin = _admin_headers("admin-cek-username")
    dobel = client.post("/auth/register", headers=admin, json={"username": "BUDI.KAPITAL", "password": "Siswa12345", "role": "siswa"})
    assert dobel.status_code == 400


def test_siswa_hanya_bisa_melaporkan_soal_dari_ujian_yang_sudah_dikumpulkan():
    headers, paket, soal_ids = setup_exam(tipe="ujian")
    with SessionLocal() as db:
        lain = Soal(teks_soal="Soal try out lain yang belum dikerjakan", tipe="esai", status="approved")
        db.add(lain)
        db.commit()
        soal_lain = lain.id
    # Soal di luar ujian siswa: ditolak dan teksnya tidak bocor.
    ditolak = client.post("/laporan-soal/", headers=headers, json={"soal_id": soal_lain, "alasan": "x"})
    assert ditolak.status_code == 404
    assert "belum dikerjakan" not in ditolak.text

    jadwal_id = active_schedule_id(paket)
    ujian_id = client.post("/ujian-siswa/mulai", headers=headers, json={"jadwal_ujian_id": jadwal_id}).json()["ujian_siswa_id"]
    soal_ujian = client.get(f"/ujian-siswa/{ujian_id}/state", headers=headers).json()["soal_urutan"][0]
    # Belum dikumpulkan: belum boleh melapor.
    assert client.post("/laporan-soal/", headers=headers, json={"soal_id": soal_ujian, "alasan": "x"}).status_code == 404
    assert client.patch(f"/ujian-siswa/{ujian_id}/submit", headers=headers).status_code == 200
    ok = client.post("/laporan-soal/", headers=headers, json={"soal_id": soal_ujian, "alasan": "Kunci salah"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["teks_soal"] is None
