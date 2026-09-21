from datetime import timedelta
from app.db.database import SessionLocal
from app.models.ujian_siswa import UjianSiswa
from app.models.soal import Soal
from app.models.opsi_jawaban import OpsiJawaban
from test_client_september17 import client, setup_exam


def test_drill_no_deadline_and_feedback_only_after_answer():
    headers, paket, ids = setup_exam()
    with SessionLocal() as db:
        soal = db.get(Soal, ids[0]); soal.tipe = "pilihan_ganda"; soal.pembahasan = "Dua tambah dua adalah empat"
        opsi = OpsiJawaban(soal_id=soal.id, teks_opsi="4", is_benar=True, urutan=1)
        db.add(opsi); db.commit(); option_id = opsi.id
    res = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "drill"})
    assert res.status_code == 200, res.text
    attempt = res.json()["ujian_siswa_id"]
    with SessionLocal() as db:
        item = db.get(UjianSiswa, attempt); item.started_at -= timedelta(days=30); db.commit()
    state = client.get(f"/ujian-siswa/{attempt}/state", headers=headers).json()
    assert state["mode_latihan"] == "drill"
    assert state["status"] == "sedang" and state["waktu_selesai"] is None
    assert state["sisa_waktu_detik"] == -1
    endpoint = f"/ujian-siswa/{attempt}/konfirmasi-drill/{ids[0]}"
    assert client.post(endpoint, headers=headers).status_code == 400
    assert client.post(f"/ujian-siswa/{attempt}/jawab", headers=headers, json={"soal_id": ids[0], "opsi_jawaban_id": option_id}).status_code == 200
    feedback = client.post(endpoint, headers=headers)
    assert feedback.status_code == 200
    assert feedback.json()["benar"] is True
    assert feedback.json()["kunci"] == ["4"]
    normal = client.post("/ujian-siswa/mulai-latihan", headers=headers, json={"paket_ujian_id": paket, "mode": "latihan"}).json()
    assert normal["ujian_siswa_id"] != attempt
    assert client.post(f"/ujian-siswa/{normal['ujian_siswa_id']}/konfirmasi-drill/{ids[0]}", headers=headers).status_code == 403
    assert client.patch(f"/ujian-siswa/{attempt}/submit", headers=headers).status_code == 200


def test_approved_revision_updates_only_packages_not_started():
    from app.models.paket_soal import PaketSoal
    from app.models.paket_ujian import PaketUjian
    from app.models.jadwal_ujian import JadwalUjian
    from app.core.timeutils import utc_now
    from test_soal_review_workflow import setup_users_and_scope, headers as login_headers
    setup_users_and_scope()
    admin_h = login_headers("workflow-admin", "WorkflowAdmin1")
    with SessionLocal() as db:
        original = Soal(teks_soal="Original", status="approved")
        db.add(original); db.flush()
        revision = Soal(teks_soal="Revised", status="pending_review", parent_soal_id=original.id)
        pending = PaketUjian(nama="Future")
        started = PaketUjian(nama="Started")
        db.add_all([revision, pending, started]); db.flush()
        for package in (pending, started):
            db.add(PaketSoal(paket_ujian_id=package.id, soal_id=original.id, urutan=7))
        db.add(JadwalUjian(paket_ujian_id=started.id, mulai=utc_now()-timedelta(minutes=1), selesai=utc_now()+timedelta(hours=1), is_published=True))
        db.commit()
        old_id, new_id, future_id, started_id = original.id, revision.id, pending.id, started.id
    assert client.post(f"/soal/{new_id}/approve", headers=admin_h, json={}).status_code == 200
    with SessionLocal() as db:
        future = db.query(PaketSoal).filter_by(paket_ujian_id=future_id).one()
        assert future.soal_id == new_id and future.urutan == 7
        assert db.query(PaketSoal).filter_by(paket_ujian_id=started_id).one().soal_id == old_id
