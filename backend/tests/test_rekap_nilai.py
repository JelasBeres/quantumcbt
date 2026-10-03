"""Rekap nilai: guru hanya melihat paket mapel yang diampu, dan latihan per mapel
dari paket try out tidak ikut menggandakan siswa di rekap."""
from uuid import uuid4

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.bagian_paket import BagianPaket
from app.models.guru_scope import GuruScope
from app.models.jadwal_ujian import JadwalUjian
from app.models.pelajaran import Pelajaran
from app.models.user import User
from tests.test_tka_pilih_mapel import _paket_tka, _siswa, client


def _staf(role, pelajaran_id=None):
    nama = f"rekap-{role}-{uuid4().hex[:6]}"
    with SessionLocal() as db:
        user = User(username=nama, password_hash=get_password_hash("Rekap123"), role=role, is_active=True)
        db.add(user)
        db.flush()
        if pelajaran_id is not None:
            db.add(GuruScope(user_id=user.id, pelajaran_id=pelajaran_id))
        db.commit()
    token = client.post("/auth/login", json={"username": nama, "password": "Rekap123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_rekap_terbatas_scope_guru_dan_tanpa_latihan_mapel():
    jadwal_id, ids = _paket_tka([("Matematika", True)], 0, 0)
    with SessionLocal() as db:
        paket_id = db.get(JadwalUjian, jadwal_id).paket_ujian_id
        bagian_id = db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket_id).scalar()
        lain = Pelajaran(nama=f"Lain {uuid4().hex[:6]}")
        db.add(lain)
        db.commit()
        lain_id = lain.id
    siswa = _siswa()
    tryout = client.post("/ujian-siswa/mulai", json={"jadwal_ujian_id": jadwal_id}, headers=siswa).json()["ujian_siswa_id"]
    client.patch(f"/ujian-siswa/{tryout}/submit", headers=siswa)
    latihan = client.post("/ujian-siswa/mulai-latihan", json={"paket_ujian_id": paket_id, "bagian_id": bagian_id}, headers=siswa)
    assert latihan.status_code == 200, latihan.text
    client.patch(f"/ujian-siswa/{latihan.json()['ujian_siswa_id']}/submit", headers=siswa)

    admin_rows = client.get("/dashboard/hasil-siswa", params={"paket_ujian_id": paket_id}, headers=_staf("admin")).json()
    assert [row["ujian_siswa_id"] for row in admin_rows] == [tryout]
    pengampu = client.get("/dashboard/hasil-siswa", headers=_staf("guru", ids["Matematika"])).json()
    assert any(row["paket_ujian_id"] == paket_id for row in pengampu)
    bukan_pengampu = client.get("/dashboard/hasil-siswa", headers=_staf("guru", lain_id)).json()
    assert all(row["paket_ujian_id"] != paket_id for row in bukan_pengampu)
