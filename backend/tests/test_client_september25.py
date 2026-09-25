from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.guru_scope import GuruScope
from app.models.jawaban_siswa import JawabanSiswa
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from test_soal_review_workflow import ensure_user, headers

client = TestClient(app)


def _setup():
    admin = ensure_user("sep25-admin", "Sep25Admin1", "admin")
    owner = ensure_user("sep25-guru", "Sep25Guru1", "guru")
    other = ensure_user("sep25-guru-other", "Sep25Other1", "guru")
    outsider = ensure_user("sep25-guru-out", "Sep25Out1", "guru")
    with SessionLocal() as db:
        pelajaran = Pelajaran(nama="Pelajaran Sep25")
        db.add(pelajaran)
        db.flush()
        db.add_all([GuruScope(user_id=owner.id, pelajaran_id=pelajaran.id), GuruScope(user_id=other.id, pelajaran_id=pelajaran.id)])
        db.commit()
        return pelajaran.id


def _approved_soal(pelajaran_id: int, teks: str = "Soal awal") -> dict:
    payload = {"pelajaran_id": pelajaran_id, "teks_soal": teks, "tipe": "esai"}
    guru_h = headers("sep25-guru", "Sep25Guru1")
    soal = client.post("/soal/", headers=guru_h, json=payload).json()
    assert client.post(f"/soal/{soal['id']}/submit-review", headers=guru_h, json={}).status_code == 200
    assert client.post(f"/soal/{soal['id']}/approve", headers=headers("sep25-admin", "Sep25Admin1"), json={}).status_code == 200
    return soal


def test_guru_edit_soal_approved_langsung_tanpa_soal_baru():
    pelajaran_id = _setup()
    soal = _approved_soal(pelajaran_id)
    other_h = headers("sep25-guru-other", "Sep25Other1")
    total_before = len(client.get("/soal/", headers=headers("sep25-admin", "Sep25Admin1")).json())

    # Guru pengampu lain mengedit soal approved: tetap id yang sama dan tetap approved.
    edited = client.put(f"/soal/{soal['id']}", headers=other_h, json={"pelajaran_id": pelajaran_id, "teks_soal": "Soal diedit", "tipe": "esai"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["id"] == soal["id"]
    assert edited.json()["status"] == "approved"
    assert len(client.get("/soal/", headers=headers("sep25-admin", "Sep25Admin1")).json()) == total_before
    history = [row["action"] for row in client.get(f"/soal/{soal['id']}/review-history", headers=other_h).json()]
    assert history[-1] == "edited"

    # Soal approved tidak bisa diajukan review ulang atau dihapus guru.
    assert client.post(f"/soal/{soal['id']}/submit-review", headers=other_h, json={}).status_code == 409
    assert client.delete(f"/soal/{soal['id']}", headers=other_h).status_code == 409

    # Guru di luar penugasan tidak bisa mengedit.
    out_h = headers("sep25-guru-out", "Sep25Out1")
    assert client.put(f"/soal/{soal['id']}", headers=out_h, json={"pelajaran_id": pelajaran_id, "teks_soal": "X", "tipe": "esai"}).status_code == 403


def test_soal_approved_yang_sudah_dijawab_siswa_terkunci():
    pelajaran_id = _setup()
    soal = _approved_soal(pelajaran_id, "Soal terpakai")
    with SessionLocal() as db:
        user = User(username="sep25-siswa", password_hash="x", role="siswa")
        paket = PaketUjian(nama="Paket Sep25")
        db.add_all([user, paket])
        db.flush()
        siswa = Siswa(user_id=user.id, nama_lengkap="Siswa Sep25")
        db.add(siswa)
        db.flush()
        ujian = UjianSiswa(siswa_id=siswa.id, paket_ujian_id=paket.id, is_submitted=True)
        db.add(ujian)
        db.flush()
        db.add(JawabanSiswa(ujian_siswa_id=ujian.id, soal_id=soal["id"], jawaban="jawaban"))
        db.commit()

    guru_h = headers("sep25-guru", "Sep25Guru1")
    locked = client.put(f"/soal/{soal['id']}", headers=guru_h, json={"pelajaran_id": pelajaran_id, "teks_soal": "Ubah", "tipe": "esai"})
    assert locked.status_code == 409
    assert "dikerjakan siswa" in locked.json()["detail"]
    with SessionLocal() as db:
        assert db.get(Soal, soal["id"]).teks_soal == "Soal terpakai"


def test_admin_isi_soal_bagian_langsung_disetujui():
    pelajaran_id = _setup()
    soal = _approved_soal(pelajaran_id, "Soal paket admin")
    admin_h = headers("sep25-admin", "Sep25Admin1")
    with SessionLocal() as db:
        paket = PaketUjian(nama="Paket Admin Sep25")
        db.add(paket)
        db.flush()
        bagian = BagianPaket(paket_ujian_id=paket.id, nama="Set 1", urutan=1, pelajaran_id=pelajaran_id)
        db.add(bagian)
        db.commit()
        paket_id, bagian_id = paket.id, bagian.id

    filled = client.put(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/soal", headers=admin_h, json={"soal_ids": [soal["id"]]})
    assert filled.status_code == 200, filled.text
    assert filled.json()["status"] == "draft"  # durasi belum diatur

    timed = client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", headers=admin_h, json={"durasi_menit": 30})
    assert timed.status_code == 200, timed.text
    assert timed.json()["status"] == "approved"
    assert timed.json()["reviewer_nama"] == "sep25-admin"

    # Guru yang mengubah isi bagian tetap membatalkan persetujuan.
    guru_h = headers("sep25-guru", "Sep25Guru1")
    changed = client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", headers=guru_h, json={"durasi_menit": 40})
    assert changed.status_code == 200
    assert changed.json()["status"] == "draft"
