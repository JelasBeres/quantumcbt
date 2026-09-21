from support import default_program_id
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, verify_password

client = TestClient(app)

def ensure_admin(username: str, password: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(username=username, password_hash=get_password_hash(password), role="admin")
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not verify_password(password, user.password_hash):
        user.password_hash = get_password_hash(password)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_token(username: str = "phase3admin", password: str = "phase3pass") -> str:
    ensure_admin(username, password)
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]




def test_program_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    # create
    r = client.post("/program/", json={"nama": "TKA", "deskripsi": "Tes Potensi", "is_active": True}, headers=headers)
    assert r.status_code == 200
    program = r.json()

    # read
    r = client.get(f"/program/{program['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "TKA"

    # update
    updated = {"nama": "TKA Updated", "deskripsi": "Tes Potensi Terbaru", "is_active": False}
    r = client.put(f"/program/{program['id']}", json=updated, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "TKA Updated"
    assert r.json()["is_active"] is False

    # list
    r = client.get("/program/", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == program['id'] for item in r.json())

    # delete
    r = client.delete(f"/program/{program['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/program/{program['id']}", headers=headers)
    assert r.status_code == 404


def test_pelajaran_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    # create program first
    r = client.post("/program/", json={"nama": "SNBT", "deskripsi": "Seleksi", "is_active": True}, headers=headers)
    assert r.status_code == 200
    program_id = r.json()["id"]

    # create pelajaran
    r = client.post("/pelajaran/", json={"nama": "Matematika", "program_id": program_id}, headers=headers)
    assert r.status_code == 200
    pelajaran = r.json()

    # read
    r = client.get(f"/pelajaran/{pelajaran['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Matematika"

    # update
    updated = {"nama": "Matematika Lanjut", "program_id": program_id}
    r = client.put(f"/pelajaran/{pelajaran['id']}", json=updated, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Matematika Lanjut"

    # list
    r = client.get("/pelajaran/", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == pelajaran['id'] for item in r.json())

    # delete
    r = client.delete(f"/pelajaran/{pelajaran['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/pelajaran/{pelajaran['id']}", headers=headers)
    assert r.status_code == 404


def test_kelas_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    r = client.post("/kelas/", json={"nama": "Kelas 12"}, headers=headers)
    assert r.status_code == 200
    kelas = r.json()

    r = client.get(f"/kelas/{kelas['id']}", headers=headers)
    assert r.status_code == 200

    r = client.put(f"/kelas/{kelas['id']}", json={"nama": "Kelas 12 IPA"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Kelas 12 IPA"

    r = client.get("/kelas/", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == kelas['id'] for item in r.json())

    r = client.delete(f"/kelas/{kelas['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/kelas/{kelas['id']}", headers=headers)
    assert r.status_code == 404


def test_siswa_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    # create related user for siswa using admin auth
    user_payload = {"username": "siswauser", "password": "SiswaPass123", "role": "siswa"}
    r = client.post("/auth/register", json=user_payload, headers=headers)
    assert r.status_code in (200, 400)
    if r.status_code == 400:
        assert "already registered" in r.json().get("detail", "")

    db = SessionLocal()
    user = db.query(User).filter(User.username == "siswauser").first()
    db.close()
    assert user is not None

    r = client.post("/siswa/", json={"user_id": user.id, "nama_lengkap": "Siswa Test", "no_induk": "12345"}, headers=headers)
    assert r.status_code == 200
    siswa = r.json()

    r = client.get(f"/siswa/{siswa['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["nama_lengkap"] == "Siswa Test"

    r = client.put(f"/siswa/{siswa['id']}", json={"user_id": user.id, "nama_lengkap": "Siswa Updated", "no_induk": "12345"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama_lengkap"] == "Siswa Updated"

    r = client.get("/siswa/", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == siswa['id'] for item in r.json())

    r = client.delete(f"/siswa/{siswa['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/siswa/{siswa['id']}", headers=headers)
    assert r.status_code == 404


def test_paket_ujian_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    data = {"program_id": default_program_id(), "nama": "Paket B", "deskripsi": "Ujian", "durasi_menit": 45, "jumlah_soal": 20, "is_random_soal": True, "is_random_opsi": True}
    r = client.post("/paket-ujian/", json=data, headers=headers)
    assert r.status_code == 200
    paket = r.json()

    r = client.get(f"/paket-ujian/{paket['id']}", headers=headers)
    assert r.status_code == 200

    r = client.put(f"/paket-ujian/{paket['id']}", json={"program_id": default_program_id(), "nama": "Paket B Updated", "deskripsi": "Ujian Lengkap", "durasi_menit": 50, "jumlah_soal": 25, "is_random_soal": False, "is_random_opsi": False}, headers=headers)
    assert r.status_code == 200
    assert r.json()["nama"] == "Paket B Updated"

    r = client.post("/soal/", json={"paket_ujian_id": paket["id"], "teks_soal": "Soal untuk clone", "tipe": "pilihan_ganda"}, headers=headers)
    assert r.status_code == 200
    soal = r.json()
    r = client.post(f"/soal/{soal['id']}/opsi", json={"teks_opsi": "Jawaban", "is_benar": True, "urutan": 1}, headers=headers)
    assert r.status_code == 200

    r = client.get(f"/paket-ujian/{paket['id']}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert len(detail["soal"]) == 1
    assert len(detail["soal"][0]["opsi_jawaban"]) == 1

    r = client.post(f"/paket-ujian/{paket['id']}/clone", json={"nama": "Paket B Clone"}, headers=headers)
    assert r.status_code == 200
    clone = r.json()
    assert clone["nama"] == "Paket B Clone"
    assert clone["id"] != paket["id"]
    assert len(clone["soal"]) == 1
    assert clone["soal"][0]["id"] == soal["id"]
    assert len(clone["soal"][0]["opsi_jawaban"]) == 1

    r = client.get("/paket-ujian/", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == paket['id'] for item in r.json())

    r = client.delete(f"/paket-ujian/{paket['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/paket-ujian/{paket['id']}", headers=headers)
    assert r.status_code == 404


def test_soal_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket C", "deskripsi": "TPA", "durasi_menit": 60, "jumlah_soal": 10, "is_random_soal": True, "is_random_opsi": True}, headers=headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "<p>Apa hasil $2+2$?</p>", "tipe": "pilihan_ganda"}, headers=headers)
    assert r.status_code == 200
    soal = r.json()

    r = client.post(f"/soal/{soal['id']}/opsi", json={"teks_opsi": "4", "is_benar": True, "urutan": 1}, headers=headers)
    assert r.status_code == 200
    opsi = r.json()
    assert opsi["soal_id"] == soal["id"]

    r = client.post(f"/soal/{soal['id']}/opsi", json={"teks_opsi": "Empat", "is_benar": True, "urutan": 1}, headers=headers)
    assert r.status_code == 400
    assert "urutan" in r.json()["detail"].lower()

    r = client.get(f"/soal/{soal['id']}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert len(detail["opsi_jawaban"]) == 1

    r = client.get(f"/soal/{soal['id']}/preview", headers=headers)
    assert r.status_code == 200
    preview = r.json()
    assert preview["contains_html"] is True
    assert preview["contains_latex"] is True

    r = client.post(
        f"/soal/{soal['id']}/upload-gambar",
        files={"file": ("soal.png", b"\x89PNG\r\n\x1a\n" + b"image-test", "image/png")},
        headers=headers,
    )
    assert r.status_code == 200
    uploaded = r.json()
    assert uploaded["gambar_url"].startswith("/uploads/soal/")
    r = client.get(uploaded["gambar_url"], headers=headers)
    assert r.status_code == 200

    r = client.put(f"/soal/{soal['id']}", json={"paket_ujian_id": paket_id, "pelajaran_id": None, "teks_soal": "Apa warna laut?", "tipe": "pilihan_ganda"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["teks_soal"] == "Apa warna laut?"

    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "Invalid tipe", "tipe": "pilihan_acak"}, headers=headers)
    assert r.status_code == 422

    r = client.get("/soal/", headers=headers)
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json()["items"]
    assert any(item["id"] == soal["id"] for item in items)

    assert client.delete(f"/soal/{soal['id']}", headers=headers).status_code == 409
    assert client.put(f"/paket-ujian/{paket_id}/soal", json={"soal_ids": []}, headers=headers).status_code == 200
    r = client.delete(f"/soal/{soal['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/soal/{soal['id']}", headers=headers)
    assert r.status_code == 404


def test_opsi_jawaban_crud():
    headers = {"Authorization": f"Bearer {get_token()}"}

    r = client.post("/paket-ujian/", json={"program_id": default_program_id(), "nama": "Paket D", "deskripsi": "Tryout", "durasi_menit": 30, "jumlah_soal": 5, "is_random_soal": True, "is_random_opsi": True}, headers=headers)
    assert r.status_code == 200
    paket_id = r.json()["id"]

    r = client.post("/soal/", json={"paket_ujian_id": paket_id, "teks_soal": "Berapa 2+2?", "tipe": "pilihan_ganda"}, headers=headers)
    assert r.status_code == 200
    soal_id = r.json()["id"]

    r = client.post("/opsi-jawaban/", json={"soal_id": soal_id, "teks_opsi": "4", "is_benar": True, "urutan": 1}, headers=headers)
    assert r.status_code == 200
    opsi = r.json()

    r = client.get(f"/opsi-jawaban/{opsi['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["is_benar"] is True

    r = client.put(f"/opsi-jawaban/{opsi['id']}", json={"soal_id": soal_id, "teks_opsi": "Empat", "is_benar": True, "urutan": 1}, headers=headers)
    assert r.status_code == 200
    assert r.json()["teks_opsi"] == "Empat"

    r = client.get(f"/opsi-jawaban/?soal_id={soal_id}", headers=headers)
    assert r.status_code == 200
    assert any(item['id'] == opsi['id'] for item in r.json())

    r = client.delete(f"/opsi-jawaban/{opsi['id']}", headers=headers)
    assert r.status_code == 200
    r = client.get(f"/opsi-jawaban/{opsi['id']}", headers=headers)
    assert r.status_code == 404
