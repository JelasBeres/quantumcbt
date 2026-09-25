"""End-to-end coverage for the bagian-paket review workflow (guru submits a
section for review; admin approves or requests revision) described in the
"Review Bagian Paket Ujian" spec."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.soal import Soal
from app.models.user import User

client = TestClient(app)


def _headers(username: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _setup():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        program = Program(nama=f"Program {suffix}", is_active=True)
        kelas = Kelas(nama=f"Kelas {suffix}")
        users = {
            "admin": User(username=f"admin-review-{suffix}", password_hash=get_password_hash("Admin123"), role="admin"),
            "owner": User(username=f"guru-owner-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
            "outsider": User(username=f"guru-outsider-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
        }
        db.add_all([program, kelas, *users.values()])
        db.flush()
        pelajaran = Pelajaran(nama=f"Matematika {suffix}", program_id=program.id)
        db.add(pelajaran)
        db.flush()
        db.add(GuruScope(user_id=users["owner"].id, pelajaran_id=pelajaran.id, program_id=program.id, kelas_id=kelas.id))
        questions = [Soal(pelajaran_id=pelajaran.id, kelas_id=kelas.id, teks_soal=f"Soal {i} {suffix}", status="approved") for i in range(3)]
        db.add_all(questions)
        db.commit()
        return {
            "usernames": {key: user.username for key, user in users.items()},
            "program_id": program.id,
            "kelas_id": kelas.id,
            "pelajaran_id": pelajaran.id,
            "soal_ids": [q.id for q in questions],
        }


def _create_paket(admin_headers, data):
    r = client.post(
        "/paket-ujian/",
        json={"program_id": data["program_id"], "kelas_id": data["kelas_id"], "nama": "Tryout Review", "jumlah_soal": 0, "is_random_soal": True, "is_random_opsi": True, "kategori": "utbk"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    paket_id = r.json()["id"]
    r = client.post(
        f"/paket-ujian/{paket_id}/bagian/",
        json={"nama": "Matematika", "urutan": 1, "pelajaran_id": data["pelajaran_id"]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return paket_id, r.json()["id"]


def test_bagian_review_full_cycle_and_package_readiness():
    data = _setup()
    admin = _headers(data["usernames"]["admin"], "Admin123")
    owner = _headers(data["usernames"]["owner"], "Guru123")
    outsider = _headers(data["usernames"]["outsider"], "Guru123")

    paket_id, bagian_id = _create_paket(admin, data)

    # Bagian baru berstatus draft.
    r = client.get(f"/paket-ujian/{paket_id}/bagian/{bagian_id}", headers=admin)
    assert r.json()["status"] == "draft"

    # Guru di luar scope tidak bisa mengisi bagian ini.
    assert client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", json={"durasi_menit": 30}, headers=outsider).status_code == 403

    # Guru pengampu mengisi durasi dan soal.
    r = client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", json={"durasi_menit": 30}, headers=owner)
    assert r.status_code == 200, r.text
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/soal", json={"soal_ids": data["soal_ids"]}, headers=owner)
    assert r.status_code == 200, r.text

    # Guru mengajukan review.
    r = client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/submit-review", json={}, headers=owner)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_review"

    # Terkunci dari perubahan selagi menunggu review.
    assert client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", json={"durasi_menit": 40}, headers=owner).status_code == 409

    # Guru tidak bisa menyetujui bagiannya sendiri.
    assert client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/setujui", json={}, headers=owner).status_code == 403

    # Admin meminta revisi dengan alasan wajib diisi.
    assert client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/minta-revisi", json={"note": "ab"}, headers=admin).status_code == 422
    r = client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/minta-revisi", json={"note": "Soal tidak sesuai mapel"}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "revision_required"
    assert r.json()["review_note"] == "Soal tidak sesuai mapel"
    assert r.json()["revision_number"] == 1

    # Guru memperbaiki dan mengajukan ulang.
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/soal", json={"soal_ids": data["soal_ids"][:2]}, headers=owner)
    assert r.status_code == 200
    r = client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/submit-review", json={}, headers=owner)
    assert r.status_code == 200
    assert r.json()["status"] == "pending_review"

    # Paket belum siap dijadwalkan karena bagian belum approved.
    r = client.get(f"/paket-ujian/{paket_id}", headers=admin)
    assert r.json()["siap_dipublikasikan"] is False
    assert r.json()["jumlah_bagian_approved"] == 0
    mulai = datetime.now(timezone.utc) + timedelta(days=1)
    r = client.post("/jadwal-ujian/", json={"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": (mulai + timedelta(hours=1)).isoformat()}, headers=admin)
    assert r.status_code == 409

    # Admin menyetujui bagian.
    r = client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/setujui", json={"note": "Layak terbit"}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    assert r.json()["reviewer_nama"]

    r = client.get(f"/paket-ujian/{paket_id}", headers=admin)
    assert r.json()["siap_dipublikasikan"] is True
    assert r.json()["jumlah_bagian_approved"] == 1

    # Sekarang jadwal boleh dibuat.
    r = client.post("/jadwal-ujian/", json={"paket_ujian_id": paket_id, "mulai": mulai.isoformat(), "selesai": (mulai + timedelta(hours=1)).isoformat()}, headers=admin)
    assert r.status_code == 200, r.text

    # Mengubah bagian yang sudah approved membalikkan status ke draft & paket tidak siap lagi.
    r = client.put(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/soal", json={"soal_ids": data["soal_ids"]}, headers=owner)
    assert r.status_code == 200
    assert r.json()["status"] == "draft"
    r = client.get(f"/paket-ujian/{paket_id}", headers=admin)
    assert r.json()["siap_dipublikasikan"] is False


def test_submit_review_requires_duration_and_approved_questions():
    data = _setup()
    admin = _headers(data["usernames"]["admin"], "Admin123")
    owner = _headers(data["usernames"]["owner"], "Guru123")
    paket_id, bagian_id = _create_paket(admin, data)

    # Tanpa durasi & soal.
    assert client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/submit-review", json={}, headers=owner).status_code == 400

    r = client.patch(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/durasi", json={"durasi_menit": 20}, headers=owner)
    assert r.status_code == 200

    # Durasi terisi tapi belum ada soal.
    assert client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/submit-review", json={}, headers=owner).status_code == 400

    r = client.put(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/soal", json={"soal_ids": data["soal_ids"][:1]}, headers=owner)
    assert r.status_code == 200

    r = client.post(f"/paket-ujian/{paket_id}/bagian/{bagian_id}/submit-review", json={}, headers=owner)
    assert r.status_code == 200
    assert r.json()["status"] == "pending_review"
