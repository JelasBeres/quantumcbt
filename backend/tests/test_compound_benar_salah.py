import json
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.jawaban_siswa import JawabanSiswa
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from app.services.scoring import calculate_ujian_score


client = TestClient(app)


def auth(role: str = "admin"):
    username = f"compound-{role}-{uuid4().hex}"
    password = "CompoundPass1"
    with SessionLocal() as db:
        user = User(username=username, password_hash=get_password_hash(password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id
    token = client.post("/auth/login", json={"username": username, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_replace_validation_custom_labels_and_no_key_leak():
    headers, _ = auth()
    soal_id = client.post("/soal/", headers=headers, json={"teks_soal": "Nilai pernyataan", "tipe": "benar_salah"}).json()["id"]
    assert client.put(f"/soal/{soal_id}/pernyataan-benar-salah", headers=headers, json={"label_benar": "Ya", "label_salah": "Ya", "pernyataan": [{"teks_pernyataan": "A", "is_benar": True}]}).status_code == 400
    response = client.put(f"/soal/{soal_id}/pernyataan-benar-salah", headers=headers, json={"label_benar": "Setuju", "label_salah": "Tidak", "pernyataan": [{"teks_pernyataan": "A", "is_benar": True}, {"teks_pernyataan": "B", "is_benar": False}]})
    assert response.status_code == 200
    assert response.json()["label_benar"] == "Setuju"
    with SessionLocal() as db:
        soal = db.query(Soal).filter(Soal.id == soal_id).first()
        detail = __import__("app.routers.soal", fromlist=["serialize_soal_detail"]).serialize_soal_detail(soal, db).model_dump()
    assert detail["label_salah"] == "Tidak"
    assert all("is_benar" not in row for row in detail["pernyataan"])


def test_compound_answer_validation_scoring_and_result_detail():
    headers, user_id = auth()
    with SessionLocal() as db:
        paket = PaketUjian(nama="Compound", durasi_menit=30, jumlah_soal=1)
        soal = Soal(teks_soal="Tabel", tipe="benar_salah", status="approved", label_benar="Benar", label_salah="Salah")
        from app.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        siswa = Siswa(user_id=user.id, nama_lengkap="Compound", no_induk=uuid4().hex)
        db.add_all([paket, soal, siswa])
        db.flush()
        db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal.id, urutan=1))
        first = PernyataanBenarSalah(soal_id=soal.id, teks_pernyataan="Satu", urutan=1, is_benar=True)
        second = PernyataanBenarSalah(soal_id=soal.id, teks_pernyataan="Dua", urutan=2, is_benar=False)
        db.add_all([first, second])
        db.flush()
        ujian = UjianSiswa(siswa_id=siswa.id, paket_ujian_id=paket.id, soal_urutan=[soal.id], opsi_urutan={}, is_submitted=False)
        db.add(ujian)
        db.commit()
        ids = ujian.id, soal.id, first.id, second.id

    ujian_id, soal_id, first_id, second_id = ids
    duplicate = client.post(f"/ujian-siswa/{ujian_id}/jawab", headers=headers, json={"soal_id": soal_id, "jawaban_pernyataan": [{"pernyataan_id": first_id, "jawaban": True}, {"pernyataan_id": first_id, "jawaban": False}]})
    assert duplicate.status_code == 400
    partial = client.post(f"/ujian-siswa/{ujian_id}/jawab", headers=headers, json={"soal_id": soal_id, "jawaban_pernyataan": [{"pernyataan_id": first_id, "jawaban": True}]})
    assert partial.status_code == 200
    with SessionLocal() as db:
        ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
        assert calculate_ujian_score(db, ujian)[0] == 0
        saved = db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian_id).first()
        saved.jawaban = json.dumps([{"pernyataan_id": first_id, "jawaban": True}, {"pernyataan_id": second_id, "jawaban": False}])
        db.commit()
        assert calculate_ujian_score(db, ujian)[0] == 100
        saved.jawaban = json.dumps([{"pernyataan_id": first_id, "jawaban": False}, {"pernyataan_id": second_id, "jawaban": False}])
        ujian.is_submitted = True
        db.commit()
        assert calculate_ujian_score(db, ujian)[0] == 0
    detail = client.get(f"/hasil-ujian/ujian/{ujian_id}/detail", headers=headers)
    assert detail.status_code == 200
    row = detail.json()["soal"][0]
    assert row["label_benar"] == "Benar"
    assert row["pernyataan"][0]["is_correct"] is False
    assert row["pernyataan"][1]["is_correct"] is True
