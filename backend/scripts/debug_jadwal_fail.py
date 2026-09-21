import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, login_attempts
from datetime import datetime, timedelta

client = TestClient(app)

db = SessionLocal()
user = db.query(User).filter(User.username == "phase5admin").first()
if not user:
    user = User(username="phase5admin", password_hash=get_password_hash("adminpass"), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)

login_attempts.clear()
r = client.post("/auth/login", json={"username": "phase5admin", "password": "adminpass"})
print("login status", r.status_code)
print(r.text)

access_token = r.json().get("access_token")
print("access_token", access_token)
headers = {"Authorization": f"Bearer {access_token}"}
now = datetime.utcnow().isoformat()
later = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
r = client.post("/jadwal-ujian/", json={"paket_ujian_id": 1, "mulai": now, "selesai": later, "is_published": True}, headers=headers)
print("jadwal status", r.status_code)
print(r.text)
