"""Riwayat siswa dipisah dua grup: Tryout (/siswa/riwayat-ujian) dan Latihan
(/siswa/riwayat-latihan)."""

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from support import active_schedule_id
from test_client_september17 import setup_exam

client = TestClient(app)


def test_riwayat_latihan_berisi_sesi_latihan_selesai_saja():
    headers, paket, _ = setup_exam(tipe="latihan", sections=True)
    with SessionLocal() as db:
        bagian_id, pelajaran_id = db.query(BagianPaket.id, BagianPaket.pelajaran_id).filter(BagianPaket.paket_ujian_id == paket).order_by(BagianPaket.urutan).first()

    ujian = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "drill", "bagian_id": bagian_id}).json()["ujian_siswa_id"]
    # Sesi yang belum dikumpulkan belum masuk riwayat.
    assert client.get("/siswa/riwayat-latihan", headers=headers).json() == []
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=headers).status_code == 200

    rows = client.get("/siswa/riwayat-latihan", headers=headers).json()
    assert len(rows) == 1
    row = rows[0]
    assert row["ujian_siswa_id"] == ujian and row["sumber"] == "latihan"
    assert row["mode_latihan"] == "drill" and row["bagian_id"] == bagian_id and row["bagian_nama"] == "Subject 0"
    # pelajaran_id dipakai frontend untuk mengelompokkan riwayat per mapel.
    assert row["pelajaran_id"] == pelajaran_id
    assert row["finished_at"] is not None
    # Grup Tryout tidak ikut berisi latihan.
    assert client.get("/siswa/riwayat-ujian", headers=headers).json() == []


def test_latihan_mapel_dari_paket_tryout_masuk_grup_latihan():
    headers, paket, _ = setup_exam(tipe="ujian", sections=True)
    with SessionLocal() as db:
        bagian_id = db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket).order_by(BagianPaket.urutan).first()[0]
        siswa_id = db.query(Siswa.id).join(User, Siswa.user_id == User.id).filter(User.username == "newflow").scalar()
    jadwal_id = active_schedule_id(paket)
    with SessionLocal() as db:
        tryout = UjianSiswa(siswa_id=siswa_id, paket_ujian_id=paket, jadwal_ujian_id=jadwal_id, is_submitted=True)
        db.add(tryout)
        db.commit()
        tryout_id = tryout.id

    ujian = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "latihan", "bagian_id": bagian_id}).json()["ujian_siswa_id"]
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=headers).status_code == 200

    latihan = client.get("/siswa/riwayat-latihan", headers=headers).json()
    assert [(row["ujian_siswa_id"], row["sumber"]) for row in latihan] == [(ujian, "tryout")]
    # Tryout berjadwalnya tetap di grup Tryout.
    tryout_rows = [row for row in client.get("/siswa/riwayat-ujian", headers=headers).json() if row["jadwal_ujian_id"] is not None]
    assert [row["ujian_siswa_id"] for row in tryout_rows] == [tryout_id]


def test_riwayat_latihan_hanya_untuk_siswa():
    from app.core.security import get_password_hash

    with SessionLocal() as db:
        db.add(User(username="rl-admin", password_hash=get_password_hash("Admin12345"), role="admin"))
        db.commit()
    token = client.post("/auth/login", json={"username": "rl-admin", "password": "Admin12345"}).json()["access_token"]
    assert client.get("/siswa/riwayat-latihan", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_detail_hasil_menyertakan_tanda_ragu():
    headers, paket, soal_ids = setup_exam(tipe="latihan")
    ujian = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "latihan"}).json()["ujian_siswa_id"]
    ragu = client.patch(f"/ujian-siswa/{ujian}/ragu", headers=headers, json={"soal_id": soal_ids[0], "is_ragu": True})
    assert ragu.status_code == 200, ragu.text
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=headers).status_code == 200

    detail = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=headers).json()
    assert {row["soal_id"]: row["is_ragu"] for row in detail["soal"]} == {soal_ids[0]: True, soal_ids[1]: False}


def test_sesi_latihan_kedaluwarsa_ditutup_dengan_hasil():
    from datetime import timedelta

    from app.core.timeutils import utc_now
    from app.models.hasil_ujian import HasilUjian

    headers, paket, _ = setup_exam(tipe="latihan")
    payload = {"paket_ujian_id": paket, "mode": "latihan"}
    lama = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload).json()["ujian_siswa_id"]
    with SessionLocal() as db:
        db.get(UjianSiswa, lama).started_at = utc_now() - timedelta(hours=2)
        db.commit()

    baru = client.post("/ujian-siswa/mulai-latihan", headers=headers, json=payload).json()["ujian_siswa_id"]
    assert baru != lama
    with SessionLocal() as db:
        assert db.get(UjianSiswa, lama).is_submitted is True
        assert db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == lama).count() == 1
    assert client.get(f"/hasil-ujian/ujian/{lama}/detail", headers=headers).status_code == 200


def test_sesi_selesai_tanpa_hasil_dihitung_saat_dibuka():
    from app.models.hasil_ujian import HasilUjian

    headers, paket, _ = setup_exam(tipe="latihan")
    ujian = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "latihan"}).json()["ujian_siswa_id"]
    # Data lama di server: sesi ditandai selesai tanpa baris hasil.
    with SessionLocal() as db:
        db.get(UjianSiswa, ujian).is_submitted = True
        db.commit()

    assert client.get(f"/hasil-ujian/ujian/{ujian}", headers=headers).status_code == 200
    assert client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=headers).status_code == 200
    with SessionLocal() as db:
        assert db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian).count() == 1
