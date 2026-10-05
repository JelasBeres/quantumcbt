"""Regresi hasil deep-dive 2026-09-24: edit soal approved, waktu habis antar
bagian, nilai manual isian, kunci ditahan selama jadwal, dan auto-submit."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.core.timeutils import utc_now
from app.db.database import SessionLocal
from app.main import app
from app.models.bagian_paket import BagianPaket
from app.models.hasil_ujian import HasilUjian
from app.models.jadwal_ujian import JadwalUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.opsi_jawaban import OpsiJawaban
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from app.scripts.auto_submit_expired import auto_submit_expired_ujian
from support import active_schedule_id, default_program_id

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


def _paket_pg(program, tipe="ujian", sections=1, durasi=30, bagian_durasi=30):
    with SessionLocal() as db:
        paket = PaketUjian(nama="Deep dive", tipe=tipe, durasi_menit=durasi, program_id=program,
                           is_random_soal=False, is_random_opsi=False)
        db.add(paket)
        db.flush()
        soal_ids = []
        for i in range(sections):
            bagian = BagianPaket(paket_ujian_id=paket.id, nama=f"Bagian {i}", urutan=i + 1,
                                 durasi_menit=bagian_durasi, status="approved")
            db.add(bagian)
            db.flush()
            soal = Soal(teks_soal=f"Soal {i}", tipe="pilihan_ganda", status="approved")
            db.add(soal)
            db.flush()
            db.add_all([
                OpsiJawaban(soal_id=soal.id, teks_opsi="benar", is_benar=True, urutan=1),
                OpsiJawaban(soal_id=soal.id, teks_opsi="salah", is_benar=False, urutan=2),
            ])
            db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal.id, urutan=i + 1, bagian_paket_id=bagian.id))
            soal_ids.append(soal.id)
        paket.jumlah_soal = sections
        db.commit()
        return paket.id, soal_ids


def _seed_higher_ids():
    # Postgres tidak pernah memakai ulang id yang dihapus; SQLite memakai ulang
    # max(id)+1. Baris dengan id lebih tinggi membuat SQLite berperilaku sama.
    with SessionLocal() as db:
        other = Soal(teks_soal="pengganjal id", tipe="benar_salah", status="draft")
        db.add(other)
        db.flush()
        db.add(OpsiJawaban(soal_id=other.id, teks_opsi="x", is_benar=True, urutan=1))
        db.add(PernyataanBenarSalah(soal_id=other.id, teks_pernyataan="x", urutan=1, is_benar=True))
        db.commit()


def _correct_opsi(soal_id):
    with SessionLocal() as db:
        return db.query(OpsiJawaban.id).filter(OpsiJawaban.soal_id == soal_id, OpsiJawaban.is_benar == True).scalar()


def test_edit_opsi_soal_approved_tidak_menolkan_jawaban_siswa():
    program = default_program_id()
    siswa = _login("dd-siswa1", "siswa", program)
    admin = _login("dd-admin1", "admin")
    paket, [soal_id] = _paket_pg(program)
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    benar = _correct_opsi(soal_id)
    assert client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": soal_id, "opsi_jawaban_id": benar}).status_code == 200
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa).status_code == 200
    _seed_higher_ids()

    opsi = client.get(f"/soal/{soal_id}", headers=admin).json()["opsi_jawaban"]
    opsi[0]["teks_opsi"] = "benar (typo diperbaiki)"
    response = client.put(f"/soal/{soal_id}/opsi", headers=admin, json={"opsi": opsi})
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()] == [item["id"] for item in opsi]

    recomputed = client.post(f"/hasil-ujian/{ujian}/compute", headers=admin)
    assert recomputed.status_code == 200, recomputed.text
    assert recomputed.json()["skor"] == 100.0


def test_edit_opsi_tanpa_id_dipasangkan_per_posisi_dan_hapus_opsi():
    program = default_program_id()
    admin = _login("dd-admin2", "admin")
    _, [soal_id] = _paket_pg(program)
    _seed_higher_ids()
    before = client.get(f"/soal/{soal_id}", headers=admin).json()["opsi_jawaban"]

    # Payload lama (tanpa id) tetap memakai baris yang sama per posisi.
    legacy = client.put(f"/soal/{soal_id}/opsi", headers=admin, json={"opsi": [
        {"teks_opsi": "A", "is_benar": True}, {"teks_opsi": "B", "is_benar": False}]})
    assert [item["id"] for item in legacy.json()] == [item["id"] for item in before]

    # Opsi yang dibuang dihapus, opsi baru dibuat.
    keep = before[0]
    changed = client.put(f"/soal/{soal_id}/opsi", headers=admin, json={"opsi": [
        {"id": keep["id"], "teks_opsi": "A", "is_benar": True}, {"teks_opsi": "C baru", "is_benar": False}]})
    assert changed.status_code == 200, changed.text
    ids = [item["id"] for item in changed.json()]
    assert ids[0] == keep["id"] and ids[1] not in {item["id"] for item in before}
    with SessionLocal() as db:
        assert db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id).count() == 2


def test_edit_pernyataan_mempertahankan_id_dan_boleh_ditukar_urutannya():
    admin = _login("dd-admin3", "admin")
    with SessionLocal() as db:
        soal = Soal(teks_soal="BS", tipe="benar_salah", status="approved", label_benar="Benar", label_salah="Salah")
        db.add(soal)
        db.flush()
        db.add_all([
            PernyataanBenarSalah(soal_id=soal.id, teks_pernyataan="P1", urutan=1, is_benar=True),
            PernyataanBenarSalah(soal_id=soal.id, teks_pernyataan="P2", urutan=2, is_benar=False),
        ])
        db.commit()
        soal_id = soal.id
    _seed_higher_ids()
    rows = client.get(f"/soal/{soal_id}", headers=admin).json()["pernyataan"]
    response = client.put(f"/soal/{soal_id}/pernyataan-benar-salah", headers=admin, json={
        "label_benar": "Benar", "label_salah": "Salah",
        "pernyataan": [
            {"id": rows[1]["id"], "teks_pernyataan": "P2", "is_benar": False},
            {"id": rows[0]["id"], "teks_pernyataan": "P1 revisi", "is_benar": True},
        ],
    })
    assert response.status_code == 200, response.text
    out = response.json()["pernyataan"]
    assert [row["id"] for row in out] == [rows[1]["id"], rows[0]["id"]]
    assert [row["urutan"] for row in out] == [1, 2]


def test_waktu_total_habis_di_bagian_non_terakhir_memberi_sinyal_kumpulkan():
    program = default_program_id()
    siswa = _login("dd-siswa4", "siswa", program)
    # Durasi paket (10) lebih kecil dari jumlah durasi bagian (2 x 30).
    paket, _ = _paket_pg(program, sections=2, durasi=10, bagian_durasi=30)
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    before = client.get(f"/ujian-siswa/{ujian}/sisa-waktu", headers=siswa).json()
    assert before["bagian_terakhir"] is False

    with SessionLocal() as db:
        db.get(UjianSiswa, ujian).started_at = utc_now() - timedelta(minutes=11)
        db.commit()
    after = client.get(f"/ujian-siswa/{ujian}/sisa-waktu", headers=siswa).json()
    assert after["sisa_waktu_detik"] == 0
    assert after["bagian_terakhir"] is True
    assert client.get(f"/ujian-siswa/{ujian}/state", headers=siswa).json()["bagian_terakhir"] is True
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa).status_code == 200


def test_nilai_manual_guru_untuk_isian_tidak_tertimpa_kunci_otomatis():
    program = default_program_id()
    siswa = _login("dd-siswa5", "siswa", program)
    admin = _login("dd-admin5", "admin")
    with SessionLocal() as db:
        paket = PaketUjian(nama="Isian", tipe="latihan", durasi_menit=30, program_id=program, is_random_soal=False)
        db.add(paket)
        db.flush()
        soal = Soal(teks_soal="1/2 = ?", tipe="isian", status="approved", kunci_jawaban="0.5")
        db.add(soal)
        db.flush()
        db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal.id, urutan=1))
        paket.jumlah_soal = 1
        db.commit()
        paket_id, soal_id = paket.id, soal.id
    ujian = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json={"paket_ujian_id": paket_id}).json()["ujian_siswa_id"]
    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": soal_id, "jawaban_teks": "0,5"})
    client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa)
    with SessionLocal() as db:
        jawaban_id = db.query(JawabanSiswa.id).filter(JawabanSiswa.ujian_siswa_id == ujian).scalar()
        assert db.query(HasilUjian.skor).filter(HasilUjian.ujian_siswa_id == ujian).scalar() == 0.0

    graded = client.patch(f"/jawaban-siswa/{jawaban_id}/nilai", headers=admin, json={"skor_manual": 100})
    assert graded.status_code == 200, graded.text
    assert client.post(f"/hasil-ujian/{ujian}/compute", headers=admin).json()["skor"] == 100.0
    with SessionLocal() as db:
        assert db.get(JawabanSiswa, jawaban_id).skor_manual == 100
    detail = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=siswa).json()
    assert detail["soal"][0]["is_correct"] is True


def test_kunci_dan_pembahasan_ditahan_selama_jadwal_tryout_berjalan():
    program = default_program_id()
    siswa = _login("dd-siswa6", "siswa", program)
    admin = _login("dd-admin6", "admin")
    paket, [soal_id] = _paket_pg(program)
    with SessionLocal() as db:
        db.get(Soal, soal_id).pembahasan = "Karena benar."
        db.commit()
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": soal_id, "opsi_jawaban_id": _correct_opsi(soal_id)})
    client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa)

    hidden = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=siswa).json()
    assert hidden["kunci_disembunyikan"] is True
    assert hidden["kunci_tersedia_at"] is not None
    item = hidden["soal"][0]
    assert item["pembahasan"] is None and item["is_correct"] is None and item["jawaban_benar"] is None
    assert all(opsi["is_benar"] is None for opsi in item["opsi"])
    assert item["jawaban_user"] is not None

    # Admin/guru tetap melihat kunci.
    assert client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=admin).json()["kunci_disembunyikan"] is False

    with SessionLocal() as db:
        db.get(JadwalUjian, jadwal).selesai = utc_now() - timedelta(minutes=1)
        db.commit()
    shown = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=siswa).json()
    assert shown["kunci_disembunyikan"] is False
    assert shown["soal"][0]["pembahasan"] == "Karena benar."
    assert shown["soal"][0]["is_correct"] is True


def test_nilai_tryout_ditahan_di_semua_endpoint_siswa_selama_jadwal_berjalan():
    program = default_program_id()
    siswa = _login("dd-siswa8", "siswa", program)
    admin = _login("dd-admin8", "admin")
    paket, [soal_id] = _paket_pg(program)
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": soal_id, "opsi_jawaban_id": _correct_opsi(soal_id)})
    client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa)

    hasil = client.get(f"/hasil-ujian/ujian/{ujian}", headers=siswa).json()
    assert hasil["skor"] is None
    meta = hasil["skor_per_pelajaran_json"]["_meta"]
    assert meta["nilai_ditahan"] is True and "skor_mentah" not in meta
    assert all("skor" not in v and "jumlah_benar" not in v for k, v in hasil["skor_per_pelajaran_json"].items() if k != "_meta")
    assert all(row["skor"] is None for row in client.get("/hasil-ujian/", headers=siswa).json())
    assert client.get(f"/hasil-ujian/{hasil['id']}", headers=siswa).json()["skor"] is None
    detail = client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=siswa).json()
    assert detail["skor"] is None and detail["skor_mentah"] is None
    riwayat = next(r for r in client.get("/siswa/riwayat-ujian", headers=siswa).json() if r["ujian_siswa_id"] == ujian)
    assert riwayat["skor"] is None and riwayat["nilai_ditahan"] is True and riwayat["skor_mentah"] is None
    assert client.get("/siswa/dashboard", headers=siswa).json()["hasil_terakhir"] is None

    # Admin tetap melihat nilai.
    assert client.get(f"/hasil-ujian/ujian/{ujian}", headers=admin).json()["skor"] == 100.0

    with SessionLocal() as db:
        db.get(JadwalUjian, jadwal).selesai = utc_now() - timedelta(minutes=1)
        db.commit()
    assert client.get(f"/hasil-ujian/ujian/{ujian}", headers=siswa).json()["skor"] == 100.0
    riwayat = next(r for r in client.get("/siswa/riwayat-ujian", headers=siswa).json() if r["ujian_siswa_id"] == ujian)
    assert riwayat["skor"] == 100.0 and riwayat["nilai_ditahan"] is False
    assert client.get("/siswa/dashboard", headers=siswa).json()["hasil_terakhir"] == 100.0


def test_auto_submit_melewati_drill_dan_mengumpulkan_tryout_yang_habis():
    program = default_program_id()
    siswa = _login("dd-siswa7", "siswa", program)
    latihan, _ = _paket_pg(program, tipe="latihan", durasi=1)
    drill = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json={"paket_ujian_id": latihan, "mode": "drill"}).json()["ujian_siswa_id"]
    tryout, _ = _paket_pg(program, durasi=30)
    jadwal = active_schedule_id(tryout)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    with SessionLocal() as db:
        db.get(UjianSiswa, drill).started_at = utc_now() - timedelta(hours=2)
        db.get(UjianSiswa, ujian).started_at = utc_now() - timedelta(minutes=31)
        db.commit()

    submitted, errors = auto_submit_expired_ujian()

    assert (submitted, errors) == (1, 0)
    with SessionLocal() as db:
        assert db.get(UjianSiswa, drill).is_submitted is False
        assert db.get(UjianSiswa, ujian).is_submitted is True
        assert db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian).first() is not None


def test_jawaban_bagian_terkunci_setelah_waktu_bagian_habis():
    program = default_program_id()
    siswa = _login("dd-siswa8", "siswa", program)
    paket, [soal_0, soal_1] = _paket_pg(program, sections=2, durasi=60, bagian_durasi=30)
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]
    jawab_0 = {"soal_id": soal_0, "opsi_jawaban_id": _correct_opsi(soal_0)}
    assert client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json=jawab_0).status_code == 200

    with SessionLocal() as db:
        db.get(UjianSiswa, ujian).started_at = utc_now() - timedelta(minutes=45)
        db.commit()
    locked = client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json=jawab_0)
    assert locked.status_code == 409
    assert "expired" not in locked.json()["detail"].lower()
    ragu = client.patch(f"/ujian-siswa/{ujian}/ragu", headers=siswa, json={"soal_id": soal_0, "is_ragu": True})
    assert ragu.status_code == 409

    # Bagian berikutnya mendapat waktunya sendiri dan bisa dijawab.
    assert client.post(f"/ujian-siswa/{ujian}/lanjut-bagian?bagian_aktif=0", headers=siswa).status_code == 200
    jawab_1 = {"soal_id": soal_1, "opsi_jawaban_id": _correct_opsi(soal_1)}
    assert client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json=jawab_1).status_code == 200


def test_latihan_mapel_dari_tryout_melanjutkan_attempt_yang_sama():
    program = default_program_id()
    siswa = _login("dd-siswa9", "siswa", program)
    paket, _ = _paket_pg(program, sections=2)
    jadwal = active_schedule_id(paket)
    with SessionLocal() as db:
        db.get(PaketUjian, paket).izinkan_pilih_mapel = True
        siswa_id = db.query(Siswa.id).filter(Siswa.nama_lengkap == "dd-siswa9").scalar()
        db.add(UjianSiswa(siswa_id=siswa_id, paket_ujian_id=paket, jadwal_ujian_id=jadwal, is_submitted=True))
        bagian_ids = [row[0] for row in db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket).order_by(BagianPaket.urutan)]
        # Attempt lama (sebelum perbaikan) tersimpan dengan mode_latihan NULL.
        legacy = UjianSiswa(siswa_id=siswa_id, paket_ujian_id=paket, latihan_bagian_id=bagian_ids[1],
                            soal_urutan=[], bagian_urutan=[{"bagian_id": bagian_ids[1], "nama": "B", "urutan": 1,
                                                             "durasi_menit": 30, "soal_ids": []}])
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id

    payload = {"paket_ujian_id": paket, "mode": "latihan", "bagian_id": bagian_ids[0]}
    first = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json=payload)
    assert first.status_code == 200, first.text
    again = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json=payload).json()["ujian_siswa_id"]
    assert again == first.json()["ujian_siswa_id"]
    # Mode drill tidak berlaku untuk paket tryout: tetap attempt berwaktu yang sama.
    drill = client.post("/ujian-siswa/mulai-latihan", headers=siswa, json={**payload, "mode": "drill"}).json()["ujian_siswa_id"]
    assert drill == again
    state = client.get(f"/ujian-siswa/{again}/state", headers=siswa).json()
    assert state["mode_latihan"] == "latihan" and state["sisa_waktu_detik"] > 0

    resumed = client.post("/ujian-siswa/mulai-latihan", headers=siswa,
                          json={**payload, "bagian_id": bagian_ids[1]}).json()["ujian_siswa_id"]
    assert resumed == legacy_id


def test_hitung_ulang_kohort_tidak_query_per_soal_per_peserta():
    from sqlalchemy import event

    from app.db.database import engine
    from app.services.scoring import compute_and_store_hasil

    n_siswa, n_soal = 20, 10
    with SessionLocal() as db:
        paket = PaketUjian(nama="Kohort", tipe="ujian", durasi_menit=60, metode_penilaian="kohort")
        db.add(paket)
        db.flush()
        soal_ids = []
        for i in range(n_soal):
            soal = Soal(teks_soal=f"K{i}", tipe="pilihan_ganda", status="approved")
            db.add(soal)
            db.flush()
            db.add_all([OpsiJawaban(soal_id=soal.id, teks_opsi="a", is_benar=True, urutan=1),
                        OpsiJawaban(soal_id=soal.id, teks_opsi="b", is_benar=False, urutan=2)])
            soal_ids.append(soal.id)
        db.flush()
        benar = dict(db.query(OpsiJawaban.soal_id, OpsiJawaban.id).filter(OpsiJawaban.is_benar == True).all())
        attempts = []
        for s in range(n_siswa):
            user = User(username=f"kohort{s}", password_hash="x", role="siswa")
            db.add(user)
            db.flush()
            siswa = Siswa(user_id=user.id, nama_lengkap=f"kohort{s}")
            db.add(siswa)
            db.flush()
            ujian = UjianSiswa(siswa_id=siswa.id, paket_ujian_id=paket.id, soal_urutan=soal_ids, is_submitted=True)
            db.add(ujian)
            db.flush()
            attempts.append(ujian.id)
            # Siswa ke-s menjawab benar s soal pertama (mod n_soal).
            for idx, sid in enumerate(soal_ids):
                if idx < s % (n_soal + 1):
                    db.add(JawabanSiswa(ujian_siswa_id=ujian.id, soal_id=sid, jawaban=str(benar[sid])))
        db.commit()

    queries = []
    listener = lambda *args, **kwargs: queries.append(1)  # noqa: E731
    event.listen(engine, "before_cursor_execute", listener)
    try:
        with SessionLocal() as db:
            compute_and_store_hasil(db, db.get(UjianSiswa, attempts[-1]))
            db.commit()
    finally:
        event.remove(engine, "before_cursor_execute", listener)

    # Dulu ~2 query per soal per peserta + 2 per hasil (> 400 di sini).
    assert len(queries) <= n_siswa + 20
    with SessionLocal() as db:
        skor = {h.ujian_siswa_id: h.skor for h in db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id.in_(attempts))}
    assert len(skor) == n_siswa
    # Lebih banyak benar -> skor tidak lebih rendah.
    urut = sorted(attempts, key=lambda a: attempts.index(a) % (n_soal + 1))
    assert [skor[a] for a in urut] == sorted(skor[a] for a in urut)


def test_guru_di_luar_penugasan_tidak_bisa_akses_hasil_dan_ujian_siswa():
    program = default_program_id()
    siswa = _login("dd-siswa10", "siswa", program)
    guru = _login("dd-guru10", "guru")
    admin = _login("dd-admin10", "admin")
    paket, [soal_id] = _paket_pg(program)
    jadwal = active_schedule_id(paket)
    ujian = client.post("/ujian-siswa/mulai", headers=siswa, json={"jadwal_ujian_id": jadwal}).json()["ujian_siswa_id"]

    # Guru tanpa penugasan tidak bisa memaksa submit / membaca state ujian siswa.
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=guru).status_code == 403
    assert client.get(f"/ujian-siswa/{ujian}/state", headers=guru).status_code == 403
    assert client.get("/ujian-siswa/", headers=guru).json() == []

    client.post(f"/ujian-siswa/{ujian}/jawab", headers=siswa, json={"soal_id": soal_id, "opsi_jawaban_id": _correct_opsi(soal_id)})
    assert client.patch(f"/ujian-siswa/{ujian}/submit", headers=siswa).status_code == 200
    assert client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=guru).status_code == 403
    assert client.post(f"/hasil-ujian/{ujian}/compute", headers=guru).status_code == 403
    assert client.get("/hasil-ujian/", headers=guru).json() == []
    # Menimpa skor manual hanya admin.
    assert client.post("/hasil-ujian/", headers=guru, json={"ujian_siswa_id": ujian, "skor": 100}).status_code == 403

    assert client.get(f"/hasil-ujian/ujian/{ujian}/detail", headers=admin).status_code == 200
    assert len(client.get("/hasil-ujian/", headers=admin).json()) == 1
