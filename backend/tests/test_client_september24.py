"""Revisi client 24 September: warna hasil mode drilling dan riwayat per
kategori -> tryout -> mapel."""

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.kategori_paket import KategoriPaket
from app.models.opsi_jawaban import OpsiJawaban
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.user import User
from support import active_schedule_id, default_program_id

client = TestClient(app)


def _siswa(username, program):
    with SessionLocal() as db:
        user = User(username=username, password_hash=get_password_hash("Rahasia123"), role="siswa")
        db.add(user)
        db.flush()
        db.add(Siswa(user_id=user.id, nama_lengkap=username, program_id=program))
        db.commit()
    token = client.post("/auth/login", json={"username": username, "password": "Rahasia123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _pg(db, teks, pelajaran_id=None):
    soal = Soal(teks_soal=teks, tipe="pilihan_ganda", status="approved", pelajaran_id=pelajaran_id, pembahasan=f"Pembahasan {teks}")
    db.add(soal)
    db.flush()
    benar = OpsiJawaban(soal_id=soal.id, teks_opsi="benar", is_benar=True, urutan=1)
    salah = OpsiJawaban(soal_id=soal.id, teks_opsi="salah", is_benar=False, urutan=2)
    db.add_all([benar, salah])
    db.flush()
    return soal.id, benar.id, salah.id


def test_drill_konfirmasi_mewarnai_dan_mengunci_jawaban():
    program = default_program_id()
    siswa = _siswa("drill24", program)
    with SessionLocal() as db:
        paket = PaketUjian(nama="Drill", tipe="latihan", durasi_menit=30, program_id=program, is_random_soal=False, is_random_opsi=False)
        db.add(paket)
        db.flush()
        pg_id, benar_id, salah_id = _pg(db, "PG")
        bs = Soal(teks_soal="BS", tipe="benar_salah", status="approved", label_benar="Benar", label_salah="Salah")
        db.add(bs)
        db.flush()
        p1 = PernyataanBenarSalah(soal_id=bs.id, teks_pernyataan="p1", urutan=1, is_benar=True)
        p2 = PernyataanBenarSalah(soal_id=bs.id, teks_pernyataan="p2", urutan=2, is_benar=False)
        db.add_all([p1, p2])
        db.flush()
        db.add_all([PaketSoal(paket_ujian_id=paket.id, soal_id=pg_id, urutan=1), PaketSoal(paket_ujian_id=paket.id, soal_id=bs.id, urutan=2)])
        paket.jumlah_soal = 2
        db.commit()
        paket_id, bs_id, p1_id, p2_id = paket.id, bs.id, p1.id, p2.id

    ujian = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json={"paket_ujian_id": paket_id, "mode": "drill"}).json()["ujian_siswa_id"]
    assert client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": pg_id, "opsi_jawaban_id": salah_id}).status_code == 200

    feedback = client.post(f"/ujian-siswa/{ujian}/konfirmasi-drill/{pg_id}", headers=siswa)
    assert feedback.status_code == 200, feedback.text
    assert feedback.json()["benar"] is False
    assert feedback.json()["kunci_opsi_ids"] == [benar_id]
    assert feedback.json()["pembahasan"] == "Pembahasan PG"

    # Setelah konfirmasi jawaban terkunci (tidak bisa mencoba opsi lain sampai hijau).
    locked = client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": pg_id, "opsi_jawaban_id": benar_id})
    assert locked.status_code == 409
    assert client.patch(f"/ujian-siswa/{ujian}/ragu", headers=siswa, json={"soal_id": pg_id, "is_ragu": True}).status_code == 200

    # Warna tetap muncul setelah halaman dimuat ulang.
    soal = client.get(f"/ujian-siswa/{ujian}/soal/1", headers=siswa).json()
    assert soal["drill_feedback"]["benar"] is False and soal["drill_feedback"]["kunci_opsi_ids"] == [benar_id]
    assert client.get(f"/ujian-siswa/{ujian}/soal/2", headers=siswa).json()["drill_feedback"] is None
    state = client.get(f"/ujian-siswa/{ujian}/state", headers=siswa).json()
    assert state["hasil_drill"] == {str(pg_id): False}

    jawab_bs = [{"pernyataan_id": p1_id, "jawaban": True}, {"pernyataan_id": p2_id, "jawaban": False}]
    assert client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": bs_id, "jawaban_pernyataan": jawab_bs}).status_code == 200
    bs_feedback = client.post(f"/ujian-siswa/{ujian}/konfirmasi-drill/{bs_id}", headers=siswa).json()
    assert bs_feedback["benar"] is True
    assert {row["pernyataan_id"]: row["jawaban_benar"] for row in bs_feedback["pernyataan"]} == {p1_id: True, p2_id: False}
    state = client.get(f"/ujian-siswa/{ujian}/state", headers=siswa).json()
    assert state["hasil_drill"] == {str(pg_id): False, str(bs_id): True}


def test_konfirmasi_hanya_untuk_mode_drill_dan_state_tryout_tanpa_hasil():
    program = default_program_id()
    siswa = _siswa("latihan24", program)
    with SessionLocal() as db:
        paket = PaketUjian(nama="Latihan", tipe="latihan", durasi_menit=30, program_id=program, is_random_soal=False)
        db.add(paket)
        db.flush()
        pg_id, _, salah_id = _pg(db, "PG")
        db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=pg_id, urutan=1))
        paket.jumlah_soal = 1
        db.commit()
        paket_id = paket.id
    ujian = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json={"paket_ujian_id": paket_id, "mode": "latihan"}).json()["ujian_siswa_id"]
    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": pg_id, "opsi_jawaban_id": salah_id})
    assert client.post(f"/ujian-siswa/{ujian}/konfirmasi-drill/{pg_id}", headers=siswa).status_code == 403
    assert client.get(f"/ujian-siswa/{ujian}/state", headers=siswa).json()["hasil_drill"] == {}
    assert client.get(f"/ujian-siswa/{ujian}/soal/1", headers=siswa).json()["drill_feedback"] is None


def test_riwayat_menyertakan_kategori_dan_detail_hasil_per_mapel():
    program = default_program_id()
    siswa = _siswa("riwayat24", program)
    with SessionLocal() as db:
        kategori = KategoriPaket(kode="utbk", nama="UTBK", tipe="ujian")
        pu = Pelajaran(nama="Penalaran Umum")
        mat = Pelajaran(nama="Matematika")
        db.add_all([kategori, pu, mat])
        db.flush()
        paket = PaketUjian(nama="UTBK 1", tipe="ujian", durasi_menit=60, program_id=program, kategori_id=kategori.id,
                           is_random_soal=False, is_random_opsi=False)
        db.add(paket)
        db.flush()
        soal_ids = {}
        for urutan, (nama, pelajaran) in enumerate([("PU 1", pu), ("Matematika 1", mat), ("Matematika 2", mat)], start=1):
            bagian = BagianPaket(paket_ujian_id=paket.id, nama=nama, urutan=urutan, pelajaran_id=pelajaran.id,
                                 durasi_menit=20, status="approved")
            db.add(bagian)
            db.flush()
            sid, benar_id, _ = _pg(db, nama, pelajaran.id)
            db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=sid, urutan=urutan, bagian_paket_id=bagian.id))
            soal_ids[nama] = (sid, benar_id, bagian.id)
        paket.jumlah_soal = 3
        db.commit()
        paket_id, pu_id, mat_id = paket.id, pu.id, mat.id

    jadwal = active_schedule_id(paket_id)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    sid, benar_id, _ = soal_ids["PU 1"]
    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": sid, "opsi_jawaban_id": benar_id})
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa).status_code == 200

    riwayat = client.get("/siswa/riwayat-ujian", headers=siswa).json()
    item = next(row for row in riwayat if row["ujian_siswa_id"] == ujian)
    assert item["kategori"] == "utbk" and item["kategori_nama"] == "UTBK"

    detail = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=siswa).json()
    assert [(b["nama"], b["pelajaran_nama"]) for b in detail["bagian"]] == [
        ("PU 1", "Penalaran Umum"), ("Matematika 1", "Matematika"), ("Matematika 2", "Matematika"),
    ]
    assert [b["pelajaran_id"] for b in detail["bagian"]] == [pu_id, mat_id, mat_id]
    per_soal = {row["soal_id"]: row["bagian_id"] for row in detail["soal"]}
    assert per_soal == {sid_: bagian_id for sid_, _, bagian_id in soal_ids.values()}


def test_esai_belum_dinilai_dihitung_nol_pada_kohort():
    from app.models.hasil_ujian import HasilUjian
    from app.models.jawaban_siswa import JawabanSiswa
    from app.models.ujian_siswa import UjianSiswa
    from app.services.scoring import compute_and_store_hasil

    with SessionLocal() as db:
        paket = PaketUjian(nama="Kohort esai", tipe="ujian", durasi_menit=60, metode_penilaian="kohort")
        db.add(paket)
        db.flush()
        pg = Soal(teks_soal="PG", tipe="pilihan_ganda", status="approved")
        esai = Soal(teks_soal="Esai", tipe="esai", status="approved")
        db.add_all([pg, esai])
        db.flush()
        benar = OpsiJawaban(soal_id=pg.id, teks_opsi="a", is_benar=True, urutan=1)
        db.add_all([benar, OpsiJawaban(soal_id=pg.id, teks_opsi="b", is_benar=False, urutan=2)])
        db.flush()
        attempts = []
        for s in range(2):
            user = User(username=f"kohort-esai{s}", password_hash="x", role="siswa")
            db.add(user)
            db.flush()
            siswa = Siswa(user_id=user.id, nama_lengkap=f"kohort-esai{s}")
            db.add(siswa)
            db.flush()
            ujian = UjianSiswa(siswa_id=siswa.id, paket_ujian_id=paket.id, soal_urutan=[pg.id, esai.id], is_submitted=True)
            db.add(ujian)
            db.flush()
            attempts.append(ujian.id)
            db.add(JawabanSiswa(ujian_siswa_id=ujian.id, soal_id=pg.id, jawaban=str(benar.id) if s == 0 else None))
            db.add(JawabanSiswa(ujian_siswa_id=ujian.id, soal_id=esai.id, jawaban="uraian"))
        db.commit()
        compute_and_store_hasil(db, db.get(UjianSiswa, attempts[0]))
        db.commit()

    with SessionLocal() as db:
        hasil = {h.ujian_siswa_id: h for h in db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id.in_(attempts))}
    pertama = hasil[attempts[0]]
    meta = pertama.skor_per_pelajaran_json["_meta"]
    # Nilai tetap keluar (esai = 0), ditandai sementara sampai guru mengoreksi.
    assert pertama.skor is not None and pertama.skor > 0
    assert meta["skor_mentah"] is not None
    assert meta["kohort_status"] == "sementara"
    assert meta["esai_belum_dinilai"] == 1 and meta["menunggu_koreksi"] is True
