from uuid import uuid4

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.bagian_paket import BagianPaket
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.soal import Soal
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def _setup():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        admin = User(username=f"package-hierarchy-admin-{suffix}", password_hash=get_password_hash("Admin123"), role="admin")
        program = Program(nama=f"Program Hierarki {suffix}", is_active=True)
        other_program = Program(nama=f"Program Lain {suffix}", is_active=True)
        db.add_all([admin, program, other_program])
        db.flush()
        first = Pelajaran(nama="Matematika", program_id=program.id)
        second = Pelajaran(nama="Bahasa Indonesia", program_id=program.id)
        foreign = Pelajaran(nama="Mapel Program Lain", program_id=other_program.id)
        inactive = Pelajaran(nama="Mapel Nonaktif", program_id=program.id, is_active=False)
        db.add_all([first, second, foreign, inactive])
        db.commit()
        return program.id, first.id, second.id, foreign.id, inactive.id, admin.username


def _headers(username, password="Admin123"):
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _payload(program_id, **overrides):
    data = {"nama": "UTBK 1", "program_id": program_id, "kategori": "utbk", "tipe": "ujian"}
    data.update(overrides)
    return data


def test_category_create_update_backward_compatibility_and_clone(isolated_database):
    program_id, _, _, _, _, username = _setup()
    headers = _headers(username)
    missing = client.post("/paket-ujian/", json={"nama": "Tanpa kategori", "program_id": program_id}, headers=headers)
    assert missing.status_code == 422
    invalid = client.post("/paket-ujian/", json=_payload(program_id, kategori="snbt"), headers=headers)
    assert invalid.status_code == 400
    created = client.post("/paket-ujian/", json=_payload(program_id), headers=headers)
    assert created.status_code == 200
    assert created.json()["kategori"] == "utbk"
    paket_id = created.json()["id"]
    updated = client.put("/paket-ujian/%s" % paket_id, json={"nama": "UTBK 1 Revisi", "program_id": program_id}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["kategori"] == "utbk"
    changed = client.put("/paket-ujian/%s" % paket_id, json=_payload(program_id, kategori="tka_sma"), headers=headers)
    assert changed.status_code == 200
    assert changed.json()["kategori"] == "tka_sma"
    cloned = client.post("/paket-ujian/%s/clone" % paket_id, json={"nama": "Clone"}, headers=headers)
    assert cloned.status_code == 200
    assert cloned.json()["kategori"] == "tka_sma"
    with SessionLocal() as db:
        legacy = PaketUjian(nama="Legacy", program_id=program_id, kategori=None)
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id
    listed = client.get("/paket-ujian/", headers=headers)
    assert listed.status_code == 200
    assert next(item for item in listed.json() if item["id"] == legacy_id)["kategori"] is None


def test_section_subject_required_unique_active_and_cross_program_allowed(isolated_database):
    program_id, first_id, second_id, foreign_id, inactive_id, username = _setup()
    headers = _headers(username)
    legacy_mismatch = client.post("/paket-ujian/", json=_payload(program_id, pelajaran_id=foreign_id), headers=headers)
    assert legacy_mismatch.status_code == 400
    assert legacy_mismatch.json()["detail"] == "Pelajaran harus berasal dari program paket"
    package = client.post("/paket-ujian/", json=_payload(program_id, pelajaran_id=None), headers=headers)
    assert package.status_code == 200
    assert package.json()["pelajaran_id"] is None
    paket_id = package.json()["id"]
    missing = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Tanpa Mapel"}, headers=headers)
    assert missing.status_code == 422
    created = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "", "pelajaran_id": first_id}, headers=headers)
    assert created.status_code == 200
    assert created.json()["nama"] == "Matematika"
    assert created.json()["durasi_menit"] is None
    duplicate = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Duplikat", "pelajaran_id": first_id}, headers=headers)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Mata pelajaran sudah digunakan oleh bagian lain dalam paket ini"
    foreign = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Lintas Program", "pelajaran_id": foreign_id}, headers=headers)
    assert foreign.status_code == 200
    assert foreign.json()["pelajaran_id"] == foreign_id
    inactive = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Nonaktif", "pelajaran_id": inactive_id}, headers=headers)
    assert inactive.status_code == 400
    assert inactive.json()["detail"] == "Mata pelajaran tidak aktif"
    second = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Bahasa", "pelajaran_id": second_id}, headers=headers)
    assert second.status_code == 200
    duplicate_update = client.put(f"/paket-ujian/{paket_id}/bagian/{second.json()['id']}", json={"pelajaran_id": first_id}, headers=headers)
    assert duplicate_update.status_code == 409
    detail = client.get(f"/paket-ujian/{paket_id}", headers=headers)
    assert detail.json()["durasi_menit"] == 0
    updated = client.put(f"/paket-ujian/{paket_id}/bagian/{created.json()['id']}", json={"nama": "Matematika Wajib"}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["durasi_menit"] is None
    assert client.delete(f"/paket-ujian/{paket_id}/bagian/{second.json()['id']}", headers=headers).status_code == 200
    assert client.get(f"/paket-ujian/{paket_id}", headers=headers).json()["durasi_menit"] == 0


def test_section_question_assignment_is_guru_only_and_scoped(isolated_database):
    program_id, first_id, _, _, _, admin_name = _setup()
    admin_headers = _headers(admin_name)
    with SessionLocal() as db:
        guru = User(username=f"section-guru-{uuid4().hex[:8]}", password_hash=get_password_hash("Guru123"), role="guru")
        db.add(guru)
        db.flush()
        db.add(GuruScope(user_id=guru.id, pelajaran_id=first_id, program_id=program_id))
        package = PaketUjian(nama="Section ownership", program_id=program_id, kategori="utbk", tipe="ujian", assigned_guru_ids=[guru.id])
        db.add(package)
        db.flush()
        section = BagianPaket(paket_ujian_id=package.id, nama="Matematika", urutan=1, pelajaran_id=first_id)
        question = Soal(pelajaran_id=first_id, teks_soal="Soal scoped", tipe="esai", status="approved")
        db.add_all([section, question])
        db.commit()
        package_id, section_id, question_id, guru_name = package.id, section.id, question.id, guru.username

    endpoint = f"/paket-ujian/{package_id}/bagian/{section_id}/soal"
    assert client.get(f"/paket-ujian/{package_id}/bagian/{section_id}", headers=admin_headers).status_code == 200
    assert client.put(endpoint, json={"soal_ids": [question_id]}, headers=admin_headers).status_code == 403
    guru_headers = _headers(guru_name, "Guru123")
    assigned = client.put(endpoint, json={"soal_ids": [question_id]}, headers=guru_headers)
    assert assigned.status_code == 200
    assert assigned.json()["soal_ids"] == [question_id]


def test_categorized_section_duration_required_and_teacher_security(isolated_database):
    program_id, first_id, _, foreign_id, _, username = _setup()
    headers = _headers(username)
    with SessionLocal() as db:
        assigned = User(username=f"assigned-{uuid4().hex[:8]}", password_hash=get_password_hash("Guru123"), role="guru")
        unassigned = User(username=f"unassigned-{uuid4().hex[:8]}", password_hash=get_password_hash("Guru123"), role="guru")
        out_of_scope = User(username=f"outscope-{uuid4().hex[:8]}", password_hash=get_password_hash("Guru123"), role="guru")
        db.add_all([assigned, unassigned, out_of_scope])
        db.flush()
        db.add(GuruScope(user_id=assigned.id, pelajaran_id=first_id, program_id=program_id))
        db.commit()
        assigned_name, unassigned_name, out_of_scope_name, assigned_id = assigned.username, unassigned.username, out_of_scope.username, assigned.id
    paket_id = client.post("/paket-ujian/", json=_payload(program_id), headers=headers).json()["id"]
    section_response = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Valid", "pelajaran_id": first_id}, headers=headers)
    assert section_response.status_code == 200
    section = section_response.json()
    assert section["durasi_menit"] is None
    foreign_section_response = client.post(f"/paket-ujian/{paket_id}/bagian/", json={"nama": "Lintas Program", "pelajaran_id": foreign_id}, headers=headers)
    assert foreign_section_response.status_code == 200
    foreign_section = foreign_section_response.json()
    assert client.put(f"/paket-ujian/{paket_id}/bagian/{section['id']}", json={"durasi_menit": 20}, headers=headers).status_code == 422
    assert client.patch(f"/paket-ujian/{paket_id}/bagian/{section['id']}/durasi", json={"durasi_menit": 35}, headers=headers).status_code == 403
    assert client.put(f"/paket-ujian/{paket_id}/penugasan", json=[assigned_id], headers=headers).status_code == 200
    assigned_headers = _headers(assigned_name, "Guru123")
    unassigned_headers = _headers(unassigned_name, "Guru123")
    out_of_scope_headers = _headers(out_of_scope_name, "Guru123")
    endpoint = f"/paket-ujian/{paket_id}/bagian/{section['id']}/durasi"
    assert client.patch(endpoint, json={"durasi_menit": 35}, headers=assigned_headers).status_code == 200
    assert client.patch(endpoint, json={"durasi_menit": 40}, headers=unassigned_headers).status_code == 403
    assert client.patch(endpoint, json={"durasi_menit": 40}, headers=out_of_scope_headers).status_code == 403
    assert client.patch(endpoint, json={"durasi_menit": 0}, headers=assigned_headers).status_code == 422
    foreign_endpoint = f"/paket-ujian/{paket_id}/bagian/{foreign_section['id']}/durasi"
    foreign_duration = client.patch(foreign_endpoint, json={"durasi_menit": 30}, headers=assigned_headers)
    assert foreign_duration.status_code == 403
    assert foreign_duration.json()["detail"] == "Pelajaran, program, atau kelas berada di luar penugasan guru"
    with SessionLocal() as db:
        foreign_question = Soal(pelajaran_id=foreign_id, teks_soal="Soal mapel lintas program", tipe="esai", status="approved")
        db.add(foreign_question)
        db.commit()
        foreign_question_id = foreign_question.id
    foreign_questions = client.put(
        f"/paket-ujian/{paket_id}/bagian/{foreign_section['id']}/soal",
        json={"soal_ids": [foreign_question_id]},
        headers=assigned_headers,
    )
    assert foreign_questions.status_code == 403
    assert foreign_questions.json()["detail"] == "Pelajaran, program, atau kelas berada di luar penugasan guru"
    package = client.get(f"/paket-ujian/{paket_id}", headers=headers).json()
    assert package["durasi_menit"] == 35
    assert package["siap_dipublikasikan"] is False
