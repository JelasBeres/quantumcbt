# 🏗️ System Architecture — CBT Quantum Research

Penjelasan detail tentang architecture, flow, dan design decisions.

---

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React/Next.js)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ Admin Panel  │ │ Guru Panel   │ │ Siswa Exam Room      │    │
│  │ (CRUD soal)  │ │ (Monitoring) │ │ (ujian, timer,       │    │
│  │              │ │              │ │  autosave)           │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            ↓↑ (HTTPS/API)
                        ┌─────────────┐
                        │  API Server │
                        │   (FastAPI) │
                        └─────────────┘
                            ↓↑ (SQL)
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                              │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐     │
│  │  Users   │ │  Soal +      │ │ Ujian, Jawaban, Hasil │     │
│  │  & Siswa │ │  Opsi        │ │                        │     │
│  └──────────┘ └──────────────┘ └────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow: Sistem Ujian (Core)

### 1. Siswa Lihat Jadwal Ujian

```
Frontend: GET /jadwal-ujian (siswa id dari token JWT)
   ↓
Backend:
  1. Parse JWT → get siswa_id
  2. Query: jadwal_ujian WHERE program_id = siswa.program_id
             AND kelas_id = siswa.kelas_id
             AND is_tersedia = true
             AND waktu_mulai <= now <= waktu_selesai (+ buffer)
  3. Return list jadwal
   ↓
Frontend: Display "Mulai Ujian" button untuk setiap jadwal
```

### 2. Siswa Klik "Mulai Ujian"

```
Frontend: POST /ujian-siswa/mulai
Body: {jadwal_ujian_id: 1}
   ↓
Backend:
  1. Validasi:
     - Jadwal valid & terbuka
     - Siswa tidak sudah ujian (status belum_mulai/selesai)
     - Time valid
  2. Query soal dari paket_ujian_id
  3. Random urutan soal: [45, 12, 89, 34, ...]
  4. Per soal, random urutan opsi: {45: [2,4,1,3], ...}
  5. Create ujian_siswa (status = 'sedang', waktu_mulai = now)
  6. Simpan urutan ke ujian_siswa.soal_urutan_json & opsi_urutan_json
  7. Return:
     {
       ujian_siswa_id: 123,
       soal_urutan: [45, 12, 89, 34, ...],
       waktu_mulai: "2026-06-25T10:00:00Z",
       sisa_waktu_detik: 3600,
       jumlah_soal: 50
     }
   ↓
Frontend:
  1. Store ujian_siswa_id di memory/context
  2. Fetch soal pertama
  3. Start timer countdown
```

### 3. Siswa Lihat Soal

```
Frontend: GET /ujian-siswa/{ujian_id}/soal/{nomor_urut}
(nomor_urut: 1-50, bukan soal_id)
   ↓
Backend:
  1. Ambil ujian_siswa dari DB
  2. Dari soal_urutan_json, ambil soal_id di posisi nomor_urut
     (e.g., position 1 → soal_id 45)
  3. Ambil soal detail + opsi dari DB
  4. Dari opsi_urutan_json, urutkan opsi sesuai urutan yang tersimpan
  5. Ambil jawaban_siswa jika sudah ada
  6. Return:
     {
       soal_id: 45,
       teks_soal: "Berapa 2+2?",
       opsi: [
         {opsi_id: 2, teks: "4", urutan: 0},
         {opsi_id: 4, teks: "6", urutan: 1},
         ...
       ],
       jawaban_user: 2  // null jika belum dijawab
     }
   ↓
Frontend: Render soal + opsi (urutan sudah konsisten)
```

### 4. Siswa Pilih Jawaban (Autosave)

```
Frontend: POST /ujian-siswa/{ujian_id}/jawab
Body: {soal_id: 45, opsi_jawaban_id: 2}
   ↓
Backend:
  1. Validasi ujian masih berlangsung
  2. Validasi soal & opsi valid
  3. UPSERT jawaban_siswa:
     IF EXISTS: UPDATE
     ELSE: INSERT
  4. Return {status: "saved", timestamp: "..."}
   ↓
Frontend: Show "Tersimpan ✓" indicator
```

### 5. Siswa Refresh / Disconnect → Resume

```
Frontend: Page refresh / reconnect
   ↓
Frontend (di useEffect): GET /ujian-siswa/{ujian_id}/state
   ↓
Backend:
  1. Fetch ujian_siswa dari DB
  2. Check status:
     - Jika timeout/selesai: return {status: "selesai"}
     - Jika masih berlangsung: return data resume
  3. Hitung sisa_waktu = durasi - (now - waktu_mulai)
  4. Return:
     {
       status: "sedang",
       soal_urutan: [45, 12, 89, ...],       // urutan konsisten
       opsi_urutan: {45: [2,4,1,3], ...},    // urutan konsisten
       jawaban: {45: 2, 12: null, ...},      // jawaban tersimpan
       sisa_waktu_detik: 1234
     }
   ↓
Frontend:
  1. Load ujian state
  2. Restore soal urutan & jawaban
  3. Resume timer dengan sisa_waktu
  4. User bisa lanjut seperti normal
```

### 6. Siswa Selesai / Waktu Habis → Submit

```
Frontend (saat user klik "Selesai"):
POST /ujian-siswa/{ujian_id}/submit
   ↓
Backend:
  1. Validasi ujian berlangsung
  2. Mark ujian_siswa status = 'submit'
  3. Set waktu_selesai_real = now
  4. Hitung durasi_diambil_detik = waktu_selesai_real - waktu_mulai
  5. Return {status: "submitted"}

** (OR) Automatic submit saat timeout:**
Backend (cron/background job):
  - Setiap menit, cek ujian_siswa WHERE status='sedang'
  - Jika sisa_waktu <= 0: auto-submit
   ↓
Frontend: Show "Ujian selesai" dialog, redirect to hasil_ujian
```

### 7. Scoring (Phase 6, automated)

```
** Post-submit:**
Backend (background job / immediate):
  1. Query jawaban_siswa per ujian_siswa_id
  2. Per soal, compare jawaban dengan opsi_jawaban.is_benar
  3. Hitung:
     - skor_total = (benar / total) * 100
     - skor_per_pelajaran
     - is_lulus = skor_total >= passing_score
  4. Create hasil_ujian record
   ↓
Frontend: GET /hasil-ujian/{ujian_id}
  - Display skor, breakdown per pelajaran, status lulus
```

---

## 🔐 Authentication & Authorization Flow

### JWT Strategy

```
1. Login
   POST /auth/login
   { username, password }
   ↓
   Backend:
   - Hash check password
   - Generate tokens:
     * access_token: exp 15 menit (untuk API)
     * refresh_token: exp 7 hari (untuk refresh)
   - Return both tokens
   ↓
   Frontend: Store tokens
   - access_token: memory/sessionStorage (safe)
   - refresh_token: httpOnly cookie (safe)

2. API Request
   GET /soal
   Header: Authorization: Bearer {access_token}
   ↓
   Backend: Verify token signature & expiry
   - If valid: proceed
   - If expired: reject 401
   ↓
   Frontend (interceptor): If 401
   - POST /auth/refresh-token dengan refresh_token
   - Get new access_token
   - Retry original request

3. Logout
   POST /auth/logout
   ↓
   Backend: (optional) blacklist token
   Frontend: Clear tokens from storage
```

### Role-Based Access Control

```
Backend dependency:
```python
from fastapi import Depends, HTTPException
from app.core.security import get_current_user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403)
    return current_user

# Endpoint hanya admin bisa akses:
@router.post("/soal")
async def create_soal(soal: SoalCreate, admin: User = Depends(get_current_admin)):
    ...
```

---

## ⏱️ Timer Backend Strategy

**PENTING:** Timer harus dihitung dari backend, bukan client!

### Mengapa Dari Backend?

```
Client-side timer (SALAH):
  - Siswa bisa manipulasi clock browser
  - Siswa bisa pause timer dengan console
  - Bisa spoof timer ke server
  ❌ Tidak aman

Server-side timer (BENAR):
  - Hitung: sisa_waktu = durasi - (now - waktu_mulai)
  - Client hanya display nilai ini
  - Bahkan kalau client spoof, server tidak peduli
  ✅ Aman & reliable
```

### Implementation

```python
# Backend service
def get_sisa_waktu(ujian_siswa: UjianSiswa) -> int:
    from datetime import datetime
    
    durasi_detik = ujian_siswa.paket_ujian.durasi_menit * 60
    elapsed = (datetime.utcnow() - ujian_siswa.waktu_mulai).total_seconds()
    sisa = durasi_detik - elapsed
    
    return max(0, int(sisa))  # minimum 0

# Endpoint
@router.get("/ujian-siswa/{ujian_id}/sisa-waktu")
async def get_sisa_waktu(ujian_id: int, current_user: User = Depends(...)):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    sisa_detik = get_sisa_waktu(ujian)
    return {
        "sisa_waktu_detik": sisa_detik,
        "server_time": datetime.utcnow().isoformat()
    }

# Frontend
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await api.get(`/ujian-siswa/${ujianId}/sisa-waktu`);
    setSisaWaktu(res.data.sisa_waktu_detik);
    if (res.data.sisa_waktu_detik <= 0) {
      submitUjian(); // auto-submit
    }
  }, 5000);  // every 5 seconds
  return () => clearInterval(interval);
}, [ujianId]);
```

---

## 💾 Autosave Strategy

### Interval-Based Autosave

```
Frontend:
- Every 5-10 seconds, batch-save jawaban yang berubah
- Call: POST /ujian-siswa/{ujian_id}/jawab

Batching logic:
- Store unsaved answers in state
- Every 5s, send to server (jika ada yang berubah)
- Mark as saved
- Show "Tersimpan ✓" indicator

Keuntungan:
✅ Mengurangi network load (tidak save per answer)
✅ User dapat visual feedback
✅ Robust terhadap lag network
```

### Backend Upsert

```python
# UPSERT pattern - sangat penting untuk idempotency
@router.post("/ujian-siswa/{ujian_id}/jawab")
async def save_jawaban(ujian_id: int, body: JawabanInput):
    # Try update dulu
    stmt = (
        update(JawabanSiswa)
        .where(
            (JawabanSiswa.ujian_siswa_id == ujian_id) &
            (JawabanSiswa.soal_id == body.soal_id)
        )
        .values(opsi_jawaban_id=body.opsi_id, waktu_dijawab=datetime.utcnow())
    )
    result = db.execute(stmt)
    db.commit()
    
    # Jika tidak ada row yang terupdate, insert baru
    if result.rowcount == 0:
        new_jawaban = JawabanSiswa(
            ujian_siswa_id=ujian_id,
            soal_id=body.soal_id,
            opsi_jawaban_id=body.opsi_id,
            waktu_dijawab=datetime.utcnow()
        )
        db.add(new_jawaban)
        db.commit()
    
    return {"status": "saved", "timestamp": datetime.utcnow().isoformat()}
```

---

## 🔀 Random Soal & Opsi Strategy

**KEY POINT:** Urutan random HARUS disimpan ke DB, jangan regenerate!

### Mulai Ujian: Generate & Save Urutan

```python
import random

@router.post("/ujian-siswa/mulai")
async def mulai_ujian(body: MulaiUjianRequest):
    # Fetch paket & soal
    paket = db.query(PaketUjian).get(body.paket_ujian_id)
    soal_list = db.query(Soal).filter(
        Soal.paket_ujian_id == paket.id
    ).all()
    
    # Random soal
    if paket.is_random_soal:
        soal_ids = [s.id for s in soal_list]
        random.shuffle(soal_ids)
    else:
        soal_ids = [s.id for s in soal_list]
    
    # Per soal, random opsi
    opsi_urutan = {}
    if paket.is_random_opsi:
        for soal_id in soal_ids:
            opsi_list = db.query(OpsiJawaban).filter(
                OpsiJawaban.soal_id == soal_id
            ).all()
            opsi_urutan_soal = [o.id for o in opsi_list]
            random.shuffle(opsi_urutan_soal)
            opsi_urutan[soal_id] = opsi_urutan_soal
    
    # Create ujian_siswa & SAVE urutan ke JSON
    ujian = UjianSiswa(
        siswa_id=current_user.siswa_id,
        jadwal_ujian_id=body.jadwal_ujian_id,
        paket_ujian_id=paket.id,
        status='sedang',
        waktu_mulai=datetime.utcnow(),
        soal_urutan_json=soal_ids,        # ⭐ SIMPAN DI SINI
        opsi_urutan_json=opsi_urutan       # ⭐ SIMPAN DI SINI
    )
    db.add(ujian)
    db.commit()
    
    return {
        "ujian_siswa_id": ujian.id,
        "soal_urutan": soal_ids,
        "waktu_mulai": ujian.waktu_mulai.isoformat(),
        "sisa_waktu_detik": paket.durasi_menit * 60
    }
```

### Fetch Soal: Gunakan Urutan Tersimpan

```python
@router.get("/ujian-siswa/{ujian_id}/soal/{nomor_urut}")
async def get_soal(ujian_id: int, nomor_urut: int):
    ujian = db.query(UjianSiswa).get(ujian_id)
    
    # Ambil urutan dari JSON (urutan yang sudah di-random & tersimpan)
    soal_ids = ujian.soal_urutan_json  # [45, 12, 89, ...]
    soal_id = soal_ids[nomor_urut - 1]  # index dari 0
    
    # Fetch soal detail
    soal = db.query(Soal).get(soal_id)
    
    # Fetch opsi & urutkan
    opsi_list = db.query(OpsiJawaban).filter(
        OpsiJawaban.soal_id == soal_id
    ).all()
    
    # Gunakan urutan tersimpan
    opsi_urutan_soal = ujian.opsi_urutan_json.get(str(soal_id), [])
    opsi_ordered = sorted(opsi_list, key=lambda o: opsi_urutan_soal.index(o.id))
    
    # Fetch jawaban siswa
    jawaban = db.query(JawabanSiswa).filter(
        (JawabanSiswa.ujian_siswa_id == ujian_id) &
        (JawabanSiswa.soal_id == soal_id)
    ).first()
    
    return {
        "soal_id": soal_id,
        "teks_soal": soal.teks_soal,
        "opsi": [
            {"opsi_id": o.id, "teks": o.teks_opsi}
            for o in opsi_ordered
        ],
        "jawaban_user": jawaban.opsi_jawaban_id if jawaban else None
    }
```

**Keuntungan:**
✅ Urutan konsisten saat refresh (ambil dari DB, bukan regenerate)  
✅ Cepat (1 JSON field)  
✅ Flexible (bisa extend dengan metadata)  

---

## 🛡️ Anti-Cheating Measures (Basic)

### 1. Tab Blur Logging

```javascript
// Frontend
useEffect(() => {
  const handleBlur = () => {
    api.post(`/ujian-siswa/${ujianId}/log-kecurangan`, {
      tipe: 'tab_blur'
    });
  };
  
  const handleFocus = () => {
    api.post(`/ujian-siswa/${ujianId}/log-kecurangan`, {
      tipe: 'tab_focus'
    });
  };
  
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  
  return () => {
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
  };
}, []);
```

### 2. Prevent Copy/Paste

```javascript
// Frontend - simple
<div onCopy={e => e.preventDefault()}>
  {/* soal area */}
</div>
```

### 3. Detect Multiple Logins

```python
# Backend
@router.post("/auth/login")
async def login(credentials: LoginRequest):
    user = authenticate_user(credentials)
    
    # Check existing active session
    existing_session = db.query(SesiLogin).filter(
        (SesiLogin.user_id == user.id) &
        (SesiLogin.logout_time == None)  # masih active
    ).first()
    
    if existing_session:
        # Detect login dari device berbeda
        if existing_session.ip_address != request.client.host:
            log_kecurangan(
                tipe='login_ganda',
                deskripsi=f'Login dari {request.client.host} (sebelumnya {existing_session.ip_address})'
            )
    
    # Create new session
    new_session = SesiLogin(
        user_id=user.id,
        ip_address=request.client.host,
        device_id=request.headers.get('X-Device-Id')
    )
    db.add(new_session)
    db.commit()
    
    token = create_access_token(user)
    return {"access_token": token}
```

---

## 📊 Data Flow: Scoring

```
After ujian submit:
1. Query jawaban_siswa for ujian_siswa_id
2. Per jawaban:
   - Get opsi_jawaban.is_benar
   - If true: increment counter_benar
3. Hitung:
   skor_total = (benar / total_soal) * 100
   skor_per_pelajaran = group by pelajaran_id, calc per group
4. Create hasil_ujian record
5. Frontend GET /hasil-ujian → display skor

Contoh:
Paket: 50 soal
  - Matematika: 20 soal
  - Bahasa: 30 soal

Siswa benar:
  - Matematika: 17/20 = 85%
  - Bahasa: 24/30 = 80%
  - Total: 41/50 = 82%

Result:
{
  "skor_total": 82,
  "skor_per_pelajaran": {
    "Matematika": 85,
    "Bahasa": 80
  },
  "is_lulus": true  // 82 >= passing_score (60)
}
```

---

## 🗂️ File Structure (Backend)

```
app/
├── __init__.py
├── main.py                 # FastAPI app initialization
├── config.py              # Settings, env variables
├── dependencies.py        # Shared dependencies
│
├── models/               # SQLAlchemy ORM models
│   ├── __init__.py
│   ├── base.py           # Base model with common fields
│   ├── user.py           # User, Siswa, etc
│   ├── soal.py
│   ├── ujian.py
│   └── ...
│
├── schemas/             # Pydantic request/response schemas
│   ├── __init__.py
│   ├── user.py
│   ├── soal.py
│   ├── ujian.py
│   └── ...
│
├── routers/             # API endpoints (FastAPI router)
│   ├── __init__.py
│   ├── auth.py          # POST /auth/login, /auth/register
│   ├── program.py       # CRUD program
│   ├── soal.py          # CRUD soal
│   ├── ujian.py         # POST /ujian/mulai, GET /ujian/soal
│   ├── dashboard.py     # GET /dashboard/*
│   └── ...
│
├── services/            # Business logic (reusable)
│   ├── __init__.py
│   ├── auth_service.py  # login, register, password hash
│   ├── soal_service.py  # soal-related logic
│   ├── ujian_service.py # ujian engine (random, timer, scoring)
│   └── ...
│
├── core/               # Core utilities
│   ├── __init__.py
│   ├── security.py     # JWT, password hashing, current_user
│   ├── exceptions.py   # Custom exceptions
│   ├── constants.py    # Enums, constants
│   └── logger.py       # Logging setup
│
└── db/                 # Database setup
    ├── __init__.py
    └── database.py     # SQLAlchemy engine, SessionLocal
```

---

## 🚀 Deployment Architecture

```
Production Setup:
┌────────────────────────┐
│  Frontend (React/Next) │ → static files (nginx/CDN)
│  Deployed on Vercel or│
│  VPS (nginx proxy)     │
└────────────────────────┘
          ↓ (HTTPS)
┌────────────────────────┐
│  Backend (FastAPI)     │ → Docker container
│  on VPS                │    with uvicorn
│  Behind nginx proxy    │
└────────────────────────┘
          ↓ (TCP)
┌────────────────────────┐
│  PostgreSQL Database   │ → Docker container or managed DB
│  on VPS                │    with automated backup
└────────────────────────┘
```

---

## ✅ Checklist Implementation by Phase

| Komponen | Phase | Status |
|----------|-------|--------|
| Database schema | 1 | 🔴 Not started |
| SQLAlchemy models | 1 | 🔴 Not started |
| Alembic migration | 1 | 🔴 Not started |
| Auth (login/JWT) | 2 | 🔴 Not started |
| CRUD soal | 3 | 🔴 Not started |
| Random logic | 5 | 🔴 Not started |
| Autosave | 5 | 🔴 Not started |
| Timer backend | 5 | 🔴 Not started |
| Scoring | 6 | 🔴 Not started |
| Dashboard | 7 | 🔴 Not started |
| Frontend UI | 8 | 🔴 Not started |

---

Last Updated: 2026-06-25
