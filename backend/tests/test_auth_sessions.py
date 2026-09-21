from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.main import app
from app.models.user import User


client = TestClient(app)


def create_user():
    with SessionLocal() as db:
        db.add(User(username="session-test", password_hash=get_password_hash("SessionTest1"), role="siswa"))
        db.commit()


def test_failed_login_can_be_retried_and_is_rate_limited():
    create_user()
    for _ in range(10):
        response = client.post("/auth/login", json={"username": "session-test", "password": "incorrect"})
        assert response.status_code == 401
    response = client.post("/auth/login", json={"username": "session-test", "password": "SessionTest1"})
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


def test_refresh_rotation_and_reuse_revokes_token_family():
    create_user()
    response = client.post("/auth/login", json={"username": "session-test", "password": "SessionTest1"})
    assert response.status_code == 200
    original = response.json()["refresh_token"]
    response = client.post("/auth/refresh-token", json={"refresh_token": original})
    assert response.status_code == 200
    rotated = response.json()["refresh_token"]
    assert rotated != original
    assert client.get("/auth/me", headers={"Authorization": "Bearer " + response.json()["access_token"]}).status_code == 200
    assert client.post("/auth/refresh-token", json={"refresh_token": original}).status_code == 401
    assert client.post("/auth/refresh-token", json={"refresh_token": rotated}).status_code == 401
