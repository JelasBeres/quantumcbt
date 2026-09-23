from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.jawaban_siswa import JawabanSiswa
from app.models.kelas import Kelas
from app.models.laporan_soal import LaporanSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User

client = TestClient(app)


def _headers(username: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _setup_security_data():
    suffix = uuid4().hex[:8]
    with SessionLocal() as db:
        program = Program(nama=f"Program {suffix}", is_active=True)
        other_program = Program(nama=f"Program Other {suffix}", is_active=True)
        kelas = Kelas(nama=f"Kelas {suffix}")
        other_kelas = Kelas(nama=f"Kelas Other {suffix}")
        users = {
            "admin": User(username=f"admin-security-{suffix}", password_hash=get_password_hash("Admin123"), role="admin"),
            "subject_a": User(username=f"guru-a-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
            "subject_b": User(username=f"guru-b-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
            "wildcard": User(username=f"guru-wild-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
            "wrong_class": User(username=f"guru-class-{suffix}", password_hash=get_password_hash("Guru123"), role="guru"),
            "student": User(username=f"student-security-{suffix}", password_hash=get_password_hash("Student123"), role="siswa"),
        }
        db.add_all([program, other_program, kelas, other_kelas, *users.values()])
        db.flush()
        subject_a = Pelajaran(nama=f"Subject A {suffix}", program_id=other_program.id)
        subject_b = Pelajaran(nama=f"Subject B {suffix}", program_id=program.id)
        db.add_all([subject_a, subject_b])
        db.flush()
        db.add_all([
            GuruScope(user_id=users["subject_a"].id, pelajaran_id=subject_a.id, program_id=program.id, kelas_id=kelas.id),
            GuruScope(user_id=users["subject_b"].id, pelajaran_id=subject_b.id, program_id=program.id, kelas_id=kelas.id),
            GuruScope(user_id=users["wildcard"].id, pelajaran_id=subject_a.id),
            GuruScope(user_id=users["wrong_class"].id, pelajaran_id=subject_a.id, program_id=program.id, kelas_id=other_kelas.id),
        ])
        package = PaketUjian(nama=f"Package {suffix}", program_id=program.id, kelas_id=kelas.id, kategori="utbk", tipe="ujian")
        wrong_class_package = PaketUjian(nama=f"Wrong Class Package {suffix}", program_id=program.id, kelas_id=other_kelas.id, kategori="utbk", tipe="ujian")
        db.add_all([package, wrong_class_package])
        db.flush()
        questions = {
            "a": Soal(pelajaran_id=subject_a.id, kelas_id=kelas.id, teks_soal="Essay subject A", tipe="esai", status="approved"),
            "b": Soal(pelajaran_id=subject_b.id, kelas_id=kelas.id, teks_soal="Essay subject B", tipe="esai", status="approved"),
            "a_other_class": Soal(pelajaran_id=subject_a.id, kelas_id=other_kelas.id, teks_soal="Essay other class", tipe="esai", status="approved"),
            "no_subject": Soal(pelajaran_id=None, kelas_id=kelas.id, teks_soal="Essay without subject", tipe="esai", status="approved"),
            "non_manual": Soal(pelajaran_id=subject_a.id, kelas_id=kelas.id, teks_soal="True false subject A", tipe="benar_salah", status="approved"),
        }
        db.add_all(questions.values())
        db.flush()
        student = Siswa(user_id=users["student"].id, nama_lengkap="Student Security", no_induk=f"SEC-{suffix}", program_id=program.id, kelas_id=kelas.id)
        db.add(student)
        db.flush()
        attempts = {
            "matching": UjianSiswa(siswa_id=student.id, paket_ujian_id=package.id, is_submitted=False),
            "wrong_class": UjianSiswa(siswa_id=student.id, paket_ujian_id=wrong_class_package.id, is_submitted=False),
        }
        db.add_all(attempts.values())
        db.flush()
        answers = {
            "a": JawabanSiswa(ujian_siswa_id=attempts["matching"].id, soal_id=questions["a"].id, jawaban="A"),
            "b": JawabanSiswa(ujian_siswa_id=attempts["matching"].id, soal_id=questions["b"].id, jawaban="B"),
            "a_wrong_class": JawabanSiswa(ujian_siswa_id=attempts["wrong_class"].id, soal_id=questions["a"].id, jawaban="A other class"),
            "no_subject": JawabanSiswa(ujian_siswa_id=attempts["matching"].id, soal_id=questions["no_subject"].id, jawaban="No subject"),
            "non_manual": JawabanSiswa(ujian_siswa_id=attempts["matching"].id, soal_id=questions["non_manual"].id, jawaban="True"),
        }
        db.add_all(answers.values())
        db.flush()
        reports = {
            "a": LaporanSoal(soal_id=questions["a"].id, user_id=users["student"].id, alasan="Report A", status="baru"),
            "b": LaporanSoal(soal_id=questions["b"].id, user_id=users["student"].id, alasan="Report B", status="baru"),
            "a_other_class": LaporanSoal(soal_id=questions["a_other_class"].id, user_id=users["student"].id, alasan="Report other class", status="baru"),
            "no_subject": LaporanSoal(soal_id=questions["no_subject"].id, user_id=users["student"].id, alasan="Report no subject", status="baru"),
        }
        db.add_all(reports.values())
        db.commit()
        return {
            "usernames": {key: user.username for key, user in users.items()},
            "answer_ids": {key: answer.id for key, answer in answers.items()},
            "report_ids": {key: report.id for key, report in reports.items()},
        }


def test_essay_correction_is_scoped_by_subject_and_package_audience():
    data = _setup_security_data()
    admin = _headers(data["usernames"]["admin"], "Admin123")
    guru_a = _headers(data["usernames"]["subject_a"], "Guru123")
    guru_b = _headers(data["usernames"]["subject_b"], "Guru123")
    wildcard = _headers(data["usernames"]["wildcard"], "Guru123")
    wrong_class = _headers(data["usernames"]["wrong_class"], "Guru123")

    assert {row["jawaban_id"] for row in client.get("/jawaban-siswa/esai/koreksi", headers=guru_a).json()} == {data["answer_ids"]["a"]}
    assert {row["jawaban_id"] for row in client.get("/jawaban-siswa/esai/koreksi", headers=guru_b).json()} == {data["answer_ids"]["b"]}
    assert {row["jawaban_id"] for row in client.get("/jawaban-siswa/esai/koreksi", headers=wildcard).json()} == {data["answer_ids"]["a"], data["answer_ids"]["a_wrong_class"]}
    assert {row["jawaban_id"] for row in client.get("/jawaban-siswa/esai/koreksi", headers=wrong_class).json()} == {data["answer_ids"]["a_wrong_class"]}
    assert {row["jawaban_id"] for row in client.get("/jawaban-siswa/esai/koreksi", headers=admin).json()} == {
        data["answer_ids"]["a"], data["answer_ids"]["b"], data["answer_ids"]["a_wrong_class"], data["answer_ids"]["no_subject"]
    }

    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['b']}/nilai", json={"skor_manual": 80}, headers=guru_a).status_code == 403
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['a_wrong_class']}/nilai", json={"skor_manual": 80}, headers=guru_a).status_code == 403
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['non_manual']}/nilai", json={"skor_manual": 80}, headers=guru_b).status_code == 403
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['no_subject']}/nilai", json={"skor_manual": 80}, headers=wildcard).status_code == 403
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['a']}/nilai", json={"skor_manual": 80}, headers=guru_a).status_code == 200
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['b']}/nilai", json={"skor_manual": 90}, headers=admin).status_code == 200
    assert client.patch(f"/jawaban-siswa/{data['answer_ids']['non_manual']}/nilai", json={"skor_manual": 90}, headers=admin).status_code == 400

    assert client.get("/jawaban-siswa/", headers=guru_a).status_code == 403
    assert client.get(f"/jawaban-siswa/{data['answer_ids']['a']}", headers=guru_a).status_code == 403
    assert len(client.get("/jawaban-siswa/", headers=admin).json()) == 5
    assert client.get(f"/jawaban-siswa/{data['answer_ids']['b']}", headers=admin).status_code == 200


def test_question_reports_use_subject_and_question_class_without_legacy_program_block():
    data = _setup_security_data()
    admin = _headers(data["usernames"]["admin"], "Admin123")
    guru_a = _headers(data["usernames"]["subject_a"], "Guru123")
    guru_b = _headers(data["usernames"]["subject_b"], "Guru123")
    wildcard = _headers(data["usernames"]["wildcard"], "Guru123")
    wrong_class = _headers(data["usernames"]["wrong_class"], "Guru123")

    assert {row["id"] for row in client.get("/laporan-soal", headers=guru_a).json()} == {data["report_ids"]["a"]}
    assert {row["id"] for row in client.get("/laporan-soal", headers=guru_b).json()} == {data["report_ids"]["b"]}
    assert {row["id"] for row in client.get("/laporan-soal", headers=wildcard).json()} == {data["report_ids"]["a"], data["report_ids"]["a_other_class"]}
    assert {row["id"] for row in client.get("/laporan-soal", headers=wrong_class).json()} == {data["report_ids"]["a_other_class"]}
    assert {row["id"] for row in client.get("/laporan-soal", headers=admin).json()} == set(data["report_ids"].values())

    assert client.patch(f"/laporan-soal/{data['report_ids']['b']}/status", json={"status": "selesai"}, headers=guru_a).status_code == 403
    assert client.patch(f"/laporan-soal/{data['report_ids']['a_other_class']}/status", json={"status": "selesai"}, headers=guru_a).status_code == 403
    assert client.patch(f"/laporan-soal/{data['report_ids']['no_subject']}/status", json={"status": "selesai"}, headers=wildcard).status_code == 403
    assert client.patch(f"/laporan-soal/{data['report_ids']['a']}/status", json={"status": "selesai"}, headers=guru_a).status_code == 200
    assert client.patch(f"/laporan-soal/{data['report_ids']['b']}/status", json={"status": "selesai"}, headers=admin).status_code == 200
