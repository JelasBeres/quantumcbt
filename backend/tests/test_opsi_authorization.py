from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.opsi_jawaban import OpsiJawaban
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.user import User
from fastapi.testclient import TestClient
from uuid import uuid4

client = TestClient(app)


def make_user(role: str):
    suffix = uuid4().hex[:8]
    username, password = f"opsi-{role}-{suffix}", "OpsiSecure1"
    db = SessionLocal()
    user = User(username=username, password_hash=get_password_hash(password), role=role, is_active=True)
    db.add(user); db.commit(); db.refresh(user); db.expunge(user); db.close()
    token = client.post("/auth/login", json={"username": username, "password": password}).json()["access_token"]
    return user, {"Authorization": f"Bearer {token}"}


def setup_questions():
    owner, owner_h = make_user("guru")
    other, other_h = make_user("guru")
    student, student_h = make_user("siswa")
    db = SessionLocal()
    pelajaran = Pelajaran(nama=f"Pelajaran Opsi {uuid4().hex[:6]}")
    db.add(pelajaran); db.flush()
    db.add_all([GuruScope(user_id=owner.id, pelajaran_id=pelajaran.id), GuruScope(user_id=other.id, pelajaran_id=pelajaran.id)])
    draft = Soal(pelajaran_id=pelajaran.id, teks_soal="Draft owner", tipe="pilihan_ganda", tingkat_kesulitan="sedang", status="draft", created_by=owner.id)
    approved = Soal(pelajaran_id=pelajaran.id, teks_soal="Approved owner", tipe="pilihan_ganda", tingkat_kesulitan="sedang", status="approved", created_by=owner.id)
    other_draft = Soal(pelajaran_id=pelajaran.id, teks_soal="Draft other", tipe="pilihan_ganda", tingkat_kesulitan="sedang", status="draft", created_by=other.id)
    db.add_all([draft, approved, other_draft]); db.flush()
    opsi = OpsiJawaban(soal_id=draft.id, teks_opsi="A", is_benar=True, urutan=1)
    db.add(opsi); db.commit()
    ids = draft.id, approved.id, other_draft.id, opsi.id
    db.close()
    return owner_h, other_h, student_h, ids


def test_option_write_requires_owner_and_editable_status():
    owner_h, other_h, student_h, (draft_id, approved_id, _, opsi_id) = setup_questions()
    ok = client.post("/opsi-jawaban/", json={"soal_id": draft_id, "teks_opsi": "B", "is_benar": False, "urutan": 2}, headers=owner_h)
    assert ok.status_code == 200
    assert client.post("/opsi-jawaban/", json={"soal_id": draft_id, "teks_opsi": "C", "is_benar": False, "urutan": 3}, headers=other_h).status_code == 403
    assert client.post("/opsi-jawaban/", json={"soal_id": approved_id, "teks_opsi": "A", "is_benar": True, "urutan": 1}, headers=owner_h).status_code == 409
    assert client.delete(f"/opsi-jawaban/{opsi_id}", headers=other_h).status_code == 403
    assert client.get(f"/opsi-jawaban/{opsi_id}", headers=student_h).status_code == 403


def test_option_cannot_move_between_questions_and_draft_key_hidden():
    owner_h, other_h, _, (draft_id, _, other_draft_id, opsi_id) = setup_questions()
    move = client.put(f"/opsi-jawaban/{opsi_id}", json={"soal_id": other_draft_id, "teks_opsi": "Moved", "is_benar": True, "urutan": 1}, headers=owner_h)
    assert move.status_code == 400
    assert client.get(f"/opsi-jawaban/?soal_id={draft_id}", headers=other_h).status_code == 403
    visible = client.get(f"/opsi-jawaban/?soal_id={draft_id}", headers=owner_h)
    assert visible.status_code == 200
