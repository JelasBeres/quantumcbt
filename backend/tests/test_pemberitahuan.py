"""Pemberitahuan siswa: promo/info dari admin dan otomatis saat paket ujian
baru dijadwalkan."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.core.timeutils import utc_now
from app.db.database import SessionLocal
from app.main import app
from app.models.paket_ujian import PaketUjian
from app.models.program import Program
from app.models.siswa import Siswa
from app.models.user import User
from support import default_program_id, make_paket_ready

client = TestClient(app)


def _login(username, role, program=None):
    with SessionLocal() as db:
        user = User(username=username, password_hash=get_password_hash("Rahasia123"), role=role)
        db.add(user)
        db.flush()
        if role == "siswa":
            db.add(Siswa(user_id=user.id, nama_lengkap=username, program_id=program))
        db.commit()
    token = client.post("/auth/login", json={"username": username, "password": "Rahasia123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _program_lain():
    with SessionLocal() as db:
        program = Program(nama="Program Lain", is_active=True)
        db.add(program)
        db.commit()
        return program.id


def test_admin_buat_promo_dan_siswa_menerima_sesuai_program():
    program = default_program_id()
    lain = _program_lain()
    admin = _login("notif-admin", "admin")
    siswa = _login("notif-siswa", "siswa", program)
    siswa_lain = _login("notif-siswa-lain", "siswa", lain)
    guru = _login("notif-guru", "guru")

    promo = {"judul": "Promo tryout 50%", "isi": "Diskon akhir bulan", "jenis": "promo", "tautan": "/siswa/tryout"}
    assert client.post("/pemberitahuan/", json=promo, headers=guru).status_code == 403
    assert client.post("/pemberitahuan/", json=promo, headers=siswa).status_code == 403
    semua = client.post("/pemberitahuan/", json=promo, headers=admin).json()
    khusus = client.post("/pemberitahuan/", json={"judul": "Khusus program", "program_id": program}, headers=admin).json()
    client.post("/pemberitahuan/", json={"judul": "Nonaktif", "is_active": False}, headers=admin)
    client.post("/pemberitahuan/", json={"judul": "Kedaluwarsa", "berlaku_sampai": (utc_now() - timedelta(minutes=1)).isoformat()}, headers=admin)

    data = client.get("/pemberitahuan/saya", headers=siswa).json()
    assert [item["judul"] for item in data["items"]] == ["Khusus program", "Promo tryout 50%"]
    assert data["belum_dibaca"] == 2
    lain_data = client.get("/pemberitahuan/saya", headers=siswa_lain).json()
    assert [item["id"] for item in lain_data["items"]] == [semua["id"]]

    # Siswa program lain tidak bisa menandai pemberitahuan yang bukan untuknya.
    assert client.post(f"/pemberitahuan/{khusus['id']}/baca", headers=siswa_lain).status_code == 404
    assert client.post(f"/pemberitahuan/{semua['id']}/baca", headers=siswa).status_code == 200
    assert client.post(f"/pemberitahuan/{semua['id']}/baca", headers=siswa).status_code == 200
    data = client.get("/pemberitahuan/saya", headers=siswa).json()
    assert data["belum_dibaca"] == 1
    assert {item["id"]: item["dibaca"] for item in data["items"]} == {semua["id"]: True, khusus["id"]: False}

    assert client.post("/pemberitahuan/baca-semua", headers=siswa).status_code == 200
    assert client.get("/pemberitahuan/saya", headers=siswa).json()["belum_dibaca"] == 0
    assert client.get("/pemberitahuan/saya", headers=siswa_lain).json()["belum_dibaca"] == 1

    rows = {row["id"]: row for row in client.get("/pemberitahuan/", headers=admin).json()}
    assert rows[semua["id"]]["jumlah_dibaca"] == 1


def test_tautan_berbahaya_ditolak():
    admin = _login("notif-admin2", "admin")
    for tautan in ("javascript:alert(1)", "//evil.example", "data:text/html,x"):
        assert client.post("/pemberitahuan/", json={"judul": "X", "tautan": tautan}, headers=admin).status_code == 422
    assert client.post("/pemberitahuan/", json={"judul": "X", "tautan": "https://quantum.example/promo"}, headers=admin).status_code == 200


def test_jadwal_dipublikasikan_membuat_pemberitahuan_paket_baru():
    program = default_program_id()
    admin = _login("notif-admin3", "admin")
    siswa = _login("notif-siswa3", "siswa", program)
    with SessionLocal() as db:
        paket = PaketUjian(nama="UTBK 7", tipe="ujian", durasi_menit=30, program_id=program)
        db.add(paket)
        db.commit()
        paket_id = paket.id
    make_paket_ready(paket_id)

    mulai = utc_now() + timedelta(hours=1)
    body = {"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": (mulai + timedelta(days=1)).isoformat(), "is_published": False}
    jadwal = client.post("/jadwal-ujian/", json=body, headers=admin).json()
    assert client.get("/pemberitahuan/saya", headers=siswa).json()["items"] == []

    assert client.patch(f"/jadwal-ujian/{jadwal['id']}/publish", json={"is_published": True}, headers=admin).status_code == 200
    items = client.get("/pemberitahuan/saya", headers=siswa).json()["items"]
    assert len(items) == 1
    assert items[0]["jenis"] == "paket_baru" and items[0]["judul"] == "Paket ujian baru: UTBK 7"
    assert items[0]["tautan"] == f"/siswa/paket/{jadwal['id']}"

    # Tarik lalu publikasikan ulang: tidak dobel.
    client.patch(f"/jadwal-ujian/{jadwal['id']}/publish", json={"is_published": False}, headers=admin)
    assert client.get("/pemberitahuan/saya", headers=siswa).json()["items"] == []
    client.patch(f"/jadwal-ujian/{jadwal['id']}/publish", json={"is_published": True}, headers=admin)
    assert len(client.get("/pemberitahuan/saya", headers=siswa).json()["items"]) == 1

    assert client.request("DELETE", f"/jadwal-ujian/{jadwal['id']}", json={"alasan": "Salah jadwal"}, headers=admin).status_code == 200
    assert client.get("/pemberitahuan/saya", headers=siswa).json()["items"] == []
