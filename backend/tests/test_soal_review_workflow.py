from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.guru_scope import GuruScope
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.user import User
from fastapi.testclient import TestClient


client = TestClient(app)


def ensure_user(username: str, password: str, role: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role=role, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.expunge(user)
    db.close()
    return user


def headers(username: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def setup_users_and_scope():
    admin = ensure_user("workflow-admin", "WorkflowAdmin1", "admin")
    guru = ensure_user("workflow-guru", "WorkflowGuru1", "guru")
    other = ensure_user("workflow-guru-other", "WorkflowOther1", "guru")
    db = SessionLocal()
    pelajaran = Pelajaran(nama="Pelajaran Workflow")
    db.add(pelajaran)
    db.flush()
    db.add(GuruScope(user_id=guru.id, pelajaran_id=pelajaran.id))
    db.add(GuruScope(user_id=other.id, pelajaran_id=pelajaran.id))
    db.commit()
    ids = (admin.id, guru.id, other.id, pelajaran.id)
    db.close()
    return ids


def test_full_soal_review_flow_and_visibility():
    admin_id, guru_id, other_id, pelajaran_id = setup_users_and_scope()
    admin_h = headers("workflow-admin", "WorkflowAdmin1")
    guru_h = headers("workflow-guru", "WorkflowGuru1")
    other_h = headers("workflow-guru-other", "WorkflowOther1")

    create = client.post("/soal/", json={
        "pelajaran_id": pelajaran_id,
        "teks_soal": "Soal workflow draft",
        "tipe": "esai",
        "tingkat_kesulitan": "sedang",
    }, headers=guru_h)
    assert create.status_code == 200
    soal_id = create.json()["id"]
    assert create.json()["status"] == "draft"
    assert create.json()["created_by"] == guru_id

    hidden = client.get(f"/soal/{soal_id}", headers=other_h)
    assert hidden.status_code == 403

    submit = client.post(f"/soal/{soal_id}/submit-review", json={"note": "Mohon direview"}, headers=guru_h)
    assert submit.status_code == 200
    assert submit.json()["status"] == "pending_review"

    locked = client.put(f"/soal/{soal_id}", json={
        "pelajaran_id": pelajaran_id,
        "teks_soal": "Tidak boleh berubah",
        "tipe": "esai",
        "tingkat_kesulitan": "sedang",
    }, headers=guru_h)
    assert locked.status_code == 409

    reject = client.post(f"/soal/{soal_id}/reject", json={"note": "Pembahasan belum lengkap"}, headers=admin_h)
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"
    assert reject.json()["rejection_reason"] == "Pembahasan belum lengkap"

    revise = client.put(f"/soal/{soal_id}", json={
        "pelajaran_id": pelajaran_id,
        "teks_soal": "Soal workflow diperbaiki",
        "tipe": "esai",
        "tingkat_kesulitan": "sedang",
        "pembahasan": "Pembahasan lengkap",
    }, headers=guru_h)
    assert revise.status_code == 200
    assert revise.json()["status"] == "draft"

    assert client.post(f"/soal/{soal_id}/submit-review", json={}, headers=guru_h).status_code == 200
    approve = client.post(f"/soal/{soal_id}/approve", json={"note": "Layak terbit"}, headers=admin_h)
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    visible = client.get(f"/soal/{soal_id}", headers=other_h)
    assert visible.status_code == 200

    generated = client.post("/soal/generate-kandidat", json={
        "pelajaran_id": pelajaran_id,
        "kesulitan": "sedang",
        "jumlah": 10,
    }, headers=other_h)
    assert generated.status_code == 200
    assert soal_id in [item["id"] for item in generated.json()["items"]]

    history = client.get(f"/soal/{soal_id}/review-history", headers=guru_h)
    assert history.status_code == 200
    actions = [row["action"] for row in history.json()]
    assert actions == ["created", "submitted", "rejected", "revised", "submitted", "approved"]


def test_admin_created_soal_is_immediately_approved():
    admin = ensure_user("workflow-admin-direct", "WorkflowDirect1", "admin")
    db = SessionLocal()
    pelajaran = Pelajaran(nama="Pelajaran Admin Approved")
    db.add(pelajaran)
    db.commit()
    pelajaran_id = pelajaran.id
    db.close()
    response = client.post("/soal/", json={
        "pelajaran_id": pelajaran_id,
        "teks_soal": "Soal admin langsung approved",
        "tipe": "esai",
        "tingkat_kesulitan": "mudah",
    }, headers=headers("workflow-admin-direct", "WorkflowDirect1"))
    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_other_teacher_revision_requires_admin_approval_and_scope():
    _, _, other_id, subject = setup_users_and_scope()
    admin_h = headers("workflow-admin", "WorkflowAdmin1")
    guru_h = headers("workflow-guru", "WorkflowGuru1")
    other_h = headers("workflow-guru-other", "WorkflowOther1")
    payload = {"pelajaran_id": subject, "teks_soal": "Published source", "tipe": "esai"}
    source = client.post("/soal/", headers=guru_h, json=payload).json()
    assert client.post(f"/soal/{source['id']}/submit-review", headers=guru_h, json={}).status_code == 200
    assert client.post(f"/soal/{source['id']}/approve", headers=other_h, json={}).status_code == 403
    assert client.post(f"/soal/{source['id']}/approve", headers=admin_h, json={}).status_code == 200
    response = client.post(f"/soal/{source['id']}/revision", headers=other_h)
    assert response.status_code == 200
    revision = response.json()
    assert revision["created_by"] == other_id
    assert revision["parent_soal_id"] == source["id"]
    assert revision["status"] == "draft"
    assert client.put(f"/soal/{revision['id']}", headers=other_h, json={**payload, "teks_soal": "Revised"}).status_code == 200
    unchanged = client.get(f"/soal/{source['id']}", headers=admin_h).json()
    assert unchanged["teks_soal"] == "Published source"
    assert unchanged["status"] == "approved"
    assert client.post(f"/soal/{revision['id']}/submit-review", headers=other_h, json={}).status_code == 200
    assert client.post(f"/soal/{revision['id']}/approve", headers=other_h, json={}).status_code == 403
    assert client.post(f"/soal/{revision['id']}/approve", headers=admin_h, json={}).status_code == 200
    rows = client.get("/soal/", headers=other_h).json()
    assert [r["id"] for r in rows] == [revision["id"], source["id"]]
    with SessionLocal() as db:
        db.query(GuruScope).filter(GuruScope.user_id == other_id).delete()
        db.commit()
    assert client.post(f"/soal/{source['id']}/revision", headers=other_h).status_code == 403
