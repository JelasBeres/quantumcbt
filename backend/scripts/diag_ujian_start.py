import sys
from pathlib import Path
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, login_attempts

client = TestClient(app)

def ensure_user(username, password, role='siswa'):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password_hash=get_password_hash(password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user

admin = ensure_user('diagadmin', 'diagpass', 'admin')
login_attempts.clear()
r = client.post('/auth/login', json={'username': 'diagadmin', 'password': 'diagpass'})
print('login', r.status_code, r.text)
if r.status_code != 200:
    raise SystemExit
headers = {'Authorization': f"Bearer {r.json()['access_token']}"}

existing = client.get('/jadwal-ujian/', headers=headers)
print('existing jadwal', existing.status_code, existing.text)

p = client.post('/paket-ujian/', json={'nama': 'Diag Paket', 'durasi_menit': 10, 'jumlah_soal': 1, 'is_random_soal': True, 'is_random_opsi': True}, headers=headers)
print('paket', p.status_code, p.text)
if p.status_code != 200:
    raise SystemExit
paket_id = p.json()['id']

q = client.post('/soal/', json={'paket_ujian_id': paket_id, 'teks_soal': '2+2?', 'tipe': 'pilihan_ganda'}, headers=headers)
print('soal', q.status_code, q.text)
if q.status_code != 200:
    raise SystemExit
soal_id = q.json()['id']

start = datetime.utcnow() - timedelta(minutes=1)
end = start + timedelta(minutes=15)
print('candidate interval', start.isoformat(), end.isoformat())
intervals = []
for item in existing.json():
    intervals.append((datetime.fromisoformat(item['mulai']), datetime.fromisoformat(item['selesai'])))
for idx, (st, ed) in enumerate(intervals, start=1):
    print('existing interval', idx, st.isoformat(), ed.isoformat())

while any(start < ed and end > st for st, ed in intervals):
    start += timedelta(days=1)
    end = start + timedelta(minutes=15)
print('adjusted interval', start.isoformat(), end.isoformat())

j = client.post('/jadwal-ujian/', json={'paket_ujian_id': paket_id, 'mulai': start.isoformat(), 'selesai': end.isoformat(), 'is_published': True}, headers=headers)
print('jadwal', j.status_code, j.text)
if j.status_code != 200:
    raise SystemExit
jadwal_id = j.json()['id']

student = ensure_user('diagstudent', 'studentpass', 'siswa')
ss = client.post('/auth/login', json={'username': 'diagstudent', 'password': 'studentpass'})
print('student login', ss.status_code, ss.text)
if ss.status_code != 200:
    raise SystemExit
headers2 = {'Authorization': f"Bearer {ss.json()['access_token']}"}

r2 = client.post('/ujian-siswa/mulai', json={'jadwal_ujian_id': jadwal_id}, headers=headers2)
print('start ujian', r2.status_code, r2.text)
