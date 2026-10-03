"""Try out TKA: siswa memilih mapel pilihan di samping mapel wajib.

Aturan: semua mapel wajib ikut, jumlah mapel pilihan antara min_mapel_pilihan
dan max_mapel_pilihan, dan soal yang diberikan hanya dari mapel terpilih.
Paket yang hanya punya mapel wajib langsung dimulai tanpa memilih.
"""
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.user import User
from tests.support import active_schedule_id

client = TestClient(app)


def _siswa():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        user = User(username=f"siswa-tka-{suffix}", password_hash=get_password_hash("Siswa123"), role="siswa")
        db.add(user)
        db.flush()
        db.add(Siswa(user_id=user.id, nama_lengkap=f"Siswa TKA {suffix}"))
        db.commit()
        username = user.username
    r = client.post("/auth/login", json={"username": username, "password": "Siswa123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _paket_tka(mapel, min_pilihan=1, max_pilihan=1):
    """mapel: daftar (nama, wajib). Tiap mapel mendapat satu bagian berisi 2 soal."""
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        paket = PaketUjian(nama=f"TKA {suffix}", tipe="ujian", durasi_menit=60, jumlah_soal=2 * len(mapel),
                           is_random_soal=False, min_mapel_pilihan=min_pilihan, max_mapel_pilihan=max_pilihan)
        db.add(paket)
        db.flush()
        ids = {}
        for urutan, (nama, wajib) in enumerate(mapel, start=1):
            pelajaran = Pelajaran(nama=f"{nama} {suffix}")
            db.add(pelajaran)
            db.flush()
            bagian = BagianPaket(paket_ujian_id=paket.id, nama=nama, urutan=urutan, pelajaran_id=pelajaran.id,
                                 durasi_menit=30, status="approved", wajib=wajib)
            db.add(bagian)
            db.flush()
            for i in range(2):
                soal = Soal(teks_soal=f"{nama} {i}", tipe="esai", status="approved", pelajaran_id=pelajaran.id)
                db.add(soal)
                db.flush()
                db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal.id, bagian_paket_id=bagian.id, urutan=urutan * 10 + i))
            ids[nama] = pelajaran.id
        db.commit()
        paket_id = paket.id
    return active_schedule_id(paket_id), ids


def _mulai(jadwal_id, pelajaran_ids=None):
    body = {"jadwal_ujian_id": jadwal_id}
    if pelajaran_ids is not None:
        body["selected_pelajaran_ids"] = pelajaran_ids
    return client.post("/ujian-siswa/mulai", json=body, headers=_siswa())


def test_tka_validasi_pilihan_mapel():
    jadwal_id, ids = _paket_tka([("Matematika", True), ("Fisika", False), ("Kimia", False)])
    mat, fis, kim = ids["Matematika"], ids["Fisika"], ids["Kimia"]

    assert _mulai(jadwal_id).status_code == 400  # belum memilih
    assert _mulai(jadwal_id, [mat]).status_code == 400  # mapel pilihan kurang dari minimum
    assert _mulai(jadwal_id, [mat, fis, kim]).status_code == 400  # melebihi maksimum
    assert _mulai(jadwal_id, [fis]).status_code == 400  # mapel wajib tidak ikut
    assert _mulai(jadwal_id, [mat, fis, 999999]).status_code == 400  # mapel di luar paket


def test_tka_soal_hanya_dari_mapel_terpilih():
    jadwal_id, ids = _paket_tka([("Matematika", True), ("Fisika", False), ("Kimia", False)])
    r = _mulai(jadwal_id, [ids["Matematika"], ids["Kimia"]])
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["jumlah_soal"] == 4
    assert len(data["soal_urutan"]) == 4
    assert {b["pelajaran_id"] for b in data["bagian_urutan"]} == {ids["Matematika"], ids["Kimia"]}


def test_tka_hanya_mapel_wajib_langsung_mulai():
    jadwal_id, ids = _paket_tka([("Matematika", True), ("Fisika", True)])
    r = _mulai(jadwal_id)
    assert r.status_code == 200, r.text
    assert len(r.json()["soal_urutan"]) == 4
