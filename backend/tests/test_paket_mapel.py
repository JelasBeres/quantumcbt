"""Alur admin latihan: Paket -> Mapel -> Set soal -> Soal.

Admin menambah mapel ke paket latihan (boleh tanpa set dulu), lalu di halaman mapel
menambah set Matematika 1, 2, 3. Guru pengampu mengisi soal tiap set.
"""
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.soal import Soal
from app.models.user import User

client = TestClient(app)


def _login(username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _setup():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        program = Program(nama=f"Program {suffix}", is_active=True)
        admin = User(username=f"admin-mapel-{suffix}", password_hash=get_password_hash("Admin123"), role="admin")
        guru = User(username=f"guru-mapel-{suffix}", password_hash=get_password_hash("Guru123"), role="guru")
        db.add_all([program, admin, guru])
        db.flush()
        mtk = Pelajaran(nama=f"Matematika {suffix}", program_id=program.id)
        fis = Pelajaran(nama=f"Fisika {suffix}", program_id=program.id)
        db.add_all([mtk, fis])
        db.flush()
        db.add(GuruScope(user_id=guru.id, pelajaran_id=mtk.id, program_id=program.id))
        soal = [Soal(pelajaran_id=mtk.id, teks_soal=f"Soal {i}", status="approved") for i in range(2)]
        db.add_all(soal)
        db.commit()
        admin_h = _login(admin.username, "Admin123")
        r = client.post("/paket-ujian/", json={"program_id": program.id, "nama": "Latihan UTBK", "tipe": "latihan", "kategori": "utbk", "jumlah_soal": 0}, headers=admin_h)
        assert r.status_code == 200, r.text
        return {
            "admin": admin_h,
            "guru": _login(guru.username, "Guru123"),
            "paket_id": r.json()["id"],
            "mtk": mtk.id,
            "fis": fis.id,
            "mtk_nama": mtk.nama,
            "soal_ids": [s.id for s in soal],
        }


def test_mapel_tanpa_set_lalu_tambah_set_dan_isi_soal():
    d = _setup()
    admin, paket_id = d["admin"], d["paket_id"]

    r = client.post(f"/paket-ujian/{paket_id}/mapel/", json={"pelajaran_id": d["mtk"]}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["jumlah_set"] == 0
    assert client.post(f"/paket-ujian/{paket_id}/mapel/", json={"pelajaran_id": d["mtk"]}, headers=admin).status_code == 409

    for _ in range(3):
        r = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"pelajaran_id": d["mtk"]}, headers=admin)
        assert r.status_code == 200, r.text
    nama_set = [b["nama"] for b in client.get(f"/paket-ujian/{paket_id}/bagian/", headers=admin).json()]
    assert nama_set == [f"{d['mtk_nama']} {i}" for i in (1, 2, 3)]

    first_set = client.get(f"/paket-ujian/{paket_id}/bagian/", headers=admin).json()[0]["id"]
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{first_set}/soal", json={"soal_ids": d["soal_ids"]}, headers=d["guru"])
    assert r.status_code == 200, r.text

    mapel = client.get(f"/paket-ujian/{paket_id}/mapel/", headers=admin).json()
    assert [(m["pelajaran_id"], m["jumlah_set"], m["jumlah_soal"]) for m in mapel] == [(d["mtk"], 3, 2)]
    # Guru hanya melihat mapel dalam lingkupnya.
    assert [m["pelajaran_id"] for m in client.get(f"/paket-ujian/{paket_id}/mapel/", headers=d["guru"]).json()] == [d["mtk"]]


def test_set_baru_otomatis_menambah_kartu_mapel_dan_hapus_mapel_menghapus_setnya():
    d = _setup()
    admin, paket_id = d["admin"], d["paket_id"]
    r = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"pelajaran_id": d["fis"]}, headers=admin)
    assert r.status_code == 200, r.text
    assert [m["pelajaran_id"] for m in client.get(f"/paket-ujian/{paket_id}/mapel/", headers=admin).json()] == [d["fis"]]

    r = client.delete(f"/paket-ujian/{paket_id}/mapel/{d['fis']}", headers=admin)
    assert r.status_code == 200, r.text
    assert client.get(f"/paket-ujian/{paket_id}/mapel/", headers=admin).json() == []
    assert client.get(f"/paket-ujian/{paket_id}/bagian/", headers=admin).json() == []


def test_hanya_admin_yang_menambah_mapel():
    d = _setup()
    r = client.post(f"/paket-ujian/{d['paket_id']}/mapel/", json={"pelajaran_id": d["mtk"]}, headers=d["guru"])
    assert r.status_code == 403
