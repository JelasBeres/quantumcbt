from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.soal import Soal
from app.models.topik import Topik
from app.models.user import User
from fastapi.testclient import TestClient


client = TestClient(app)


def auth_headers() -> dict[str, str]:
    db = SessionLocal()
    username = "generate-kandidat-admin"
    password = "Generate123"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role="admin", is_active=True)
        db.add(user)
        db.commit()
    db.close()
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_generate_kandidat_filters_and_reports_shortage():
    db = SessionLocal()
    program = Program(nama="Program Generate", deskripsi="test", is_active=True)
    kelas = Kelas(nama="Kelas Generate")
    db.add_all([program, kelas])
    db.flush()
    pelajaran = Pelajaran(nama="Pelajaran Generate", program_id=program.id)
    db.add(pelajaran)
    db.flush()
    topik = Topik(pelajaran_id=pelajaran.id, nama="Bab Generate", is_active=True)
    db.add(topik)
    db.flush()
    soal = [
        Soal(pelajaran_id=pelajaran.id, kelas_id=kelas.id, topik_id=topik.id, teks_soal=f"Soal mudah {i}", tingkat_kesulitan="mudah", tipe="pilihan_ganda", status="approved")
        for i in range(3)
    ]
    soal.append(Soal(pelajaran_id=pelajaran.id, kelas_id=kelas.id, topik_id=topik.id, teks_soal="Soal sulit", tingkat_kesulitan="sulit", tipe="pilihan_ganda"))
    db.add_all(soal)
    db.commit()

    response = client.post(
        "/soal/generate-kandidat",
        json={
            "pelajaran_id": pelajaran.id,
            "kelas_id": kelas.id,
            "topik_id": topik.id,
            "tipe": "pilihan_ganda",
            "kesulitan": "mudah",
            "jumlah": 5,
            "exclude_ids": [],
        },
        headers=auth_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["requested"] == 5
    assert body["available"] == 3
    assert body["selected"] == 3
    assert body["shortage"] == 2
    assert len({item["id"] for item in body["items"]}) == 3
    assert all(item["tingkat_kesulitan"] == "mudah" for item in body["items"])
    db.close()


def test_generate_kandidat_rejects_topik_from_other_subject():
    db = SessionLocal()
    pelajaran_a = Pelajaran(nama="Pelajaran A")
    pelajaran_b = Pelajaran(nama="Pelajaran B")
    db.add_all([pelajaran_a, pelajaran_b])
    db.flush()
    topik_b = Topik(pelajaran_id=pelajaran_b.id, nama="Bab B", is_active=True)
    db.add(topik_b)
    db.commit()

    response = client.post(
        "/soal/generate-kandidat",
        json={
            "pelajaran_id": pelajaran_a.id,
            "topik_id": topik_b.id,
            "tipe": "pilihan_ganda",
            "kesulitan": "sedang",
            "jumlah": 5,
        },
        headers=auth_headers(),
    )
    assert response.status_code == 400
    db.close()
