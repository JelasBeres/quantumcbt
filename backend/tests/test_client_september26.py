from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.timeutils import utc_now
from app.db.database import SessionLocal
from app.main import app
from app.models.jadwal_ujian import JadwalUjian
from app.models.kelas import Kelas
from app.models.paket_ujian import PaketUjian
from app.models.siswa import Siswa
from test_soal_review_workflow import ensure_user, headers

client = TestClient(app)


def _jadwal(db, nama: str, paket_kelas_id, jadwal_kelas_id=None) -> int:
    paket = PaketUjian(nama=nama, tipe="ujian", kelas_id=paket_kelas_id)
    db.add(paket)
    db.flush()
    jadwal = JadwalUjian(
        paket_ujian_id=paket.id,
        mulai=utc_now() - timedelta(hours=1),
        selesai=utc_now() + timedelta(hours=2),
        is_published=True,
        status="approved",
        kelas_id=jadwal_kelas_id,
    )
    db.add(jadwal)
    db.flush()
    return jadwal.id


def test_tryout_siswa_hanya_sesuai_kelas():
    user = ensure_user("sep26-siswa", "Sep26Siswa1", "siswa")
    with SessionLocal() as db:
        kelas_saya, kelas_lain = Kelas(nama="Kelas Sep26 A"), Kelas(nama="Kelas Sep26 B")
        db.add_all([kelas_saya, kelas_lain])
        db.flush()
        siswa = db.query(Siswa).filter(Siswa.user_id == user.id).first()
        if not siswa:
            siswa = Siswa(user_id=user.id, nama_lengkap="Siswa Sep26")
            db.add(siswa)
        siswa.program_id = None
        siswa.kelas_id = kelas_saya.id
        cocok = _jadwal(db, "Tryout Sep26 kelas saya", kelas_saya.id)
        semua = _jadwal(db, "Tryout Sep26 semua kelas", None)
        # Jadwal tanpa kelas mengikuti kelas paketnya.
        lain_via_paket = _jadwal(db, "Tryout Sep26 kelas lain (paket)", kelas_lain.id)
        lain_via_jadwal = _jadwal(db, "Tryout Sep26 kelas lain (jadwal)", None, kelas_lain.id)
        db.commit()

    siswa_h = headers("sep26-siswa", "Sep26Siswa1")
    ids = {row["jadwal_ujian_id"] for row in client.get("/siswa/jadwal-tersedia", headers=siswa_h).json()}
    assert {cocok, semua} <= ids
    assert not {lain_via_paket, lain_via_jadwal} & ids

    ids_jadwal = {row["jadwal_ujian_id"] for row in client.get("/siswa/jadwal-ujian", headers=siswa_h).json()}
    assert lain_via_paket not in ids_jadwal

    # Tidak bisa dibuka lewat URL langsung juga.
    mulai = client.post("/ujian-siswa/mulai", headers=siswa_h, json={"jadwal_ujian_id": lain_via_paket})
    assert mulai.status_code == 403, mulai.text
