# 📋 Quick Reference — CBT Quantum Research

Cheat sheet untuk quick reference sambil development.

---

## 🎯 Project Overview (TL;DR)

```
Nama:         Quantum Research CBT System
Tujuan:       Sistem ujian online untuk bimbel
Tech Stack:   FastAPI + PostgreSQL + Next.js/React
Timeline:     4-5 bulan (solo dev)
Status:       Backend 100% + Frontend Auth/CRUD; next = exam room (lihat AI_HANDOFF.md)
```

---

## 📊 10 Phases At A Glance

```
Phase 0  | Persiapan             | 1 week  | 🟡 In Progress (branding/commit)
Phase 1  | Backend & Database    | 1-2 wks | ✅ Complete
Phase 2  | Authentication        | 1 week  | ✅ Complete
Phase 3  | CRUD Master Data      | 1-2 wks | ✅ Complete
Phase 4  | Jadwal Ujian          | 3-5 day | ✅ Complete
Phase 5  | Mesin Ujian ⭐        | 2-3 wks | 🟡 In Progress (needs disruption test)
Phase 6  | Scoring & Hasil       | 1 week  | ✅ Complete
Phase 7  | Dashboard & Monitor   | 1-2 wks | ✅ Complete (+ Grouping)
Phase 8  | Frontend Lengkap      | 3-4 wks | 🟡 ~55% (Auth+CRUD+Soal/Opsi)
Phase 9  | Testing & QA          | 2 wks   | 🔴 Not started
Phase 10 | Deployment Go-Live    | 3-5 day | 🔴 Not started
```

---

## 🗄️ Database: 13 Tabel Utama

```
1. users              → login credentials (admin, guru, siswa)
2. siswa              → profil siswa + program
3. program            → TKA, SNBT, Speedtest, Ujian Mandiri
4. pelajaran          → Matematika, IPA, Bahasa, etc
5. kelas              → Kelas 12, Kelas 11, etc
6. paket_ujian        → Kumpulan soal jadi satu paket
7. soal               → Isi soal (dengan LaTeX support)
8. opsi_jawaban       → Pilihan A, B, C, D, E
9. jadwal_ujian       → Kapan ujian berlangsung
10. ujian_siswa       → Instance ujian per siswa (urutan soal + status)
11. jawaban_siswa     → Jawaban yang diberikan siswa per soal
12. hasil_ujian       → Skor & hasil ujian
13. log_kecurangan    → Log aktivitas mencurigakan saat ujian

+ tambahan:
  sesi_login          → Track device/IP per login
  pengaturan          → Setting global sistem
```

---

## 🔐 Security Must-Have

```
✅ Password: bcrypt hashing (jangan plain text!)
✅ Auth: JWT tokens (access 15 min, refresh 7 hari)
✅ Timer: dari backend (client jangan hitung!)
✅ Random: simpan urutan ke DB (jangan regenerate)
✅ Anti-copy: disable copy/paste di halaman ujian
✅ Rate limit: max 5x login attempts per 5 menit
✅ Logging: track semua activity kecurangan
```

---

## 🏗️ Backend Architecture

```
FastAPI App Structure:
  app/
  ├── main.py           ← entry point
  ├── config.py         ← settings & env vars
  ├── models/           ← SQLAlchemy ORM (13 tabel)
  ├── schemas/          ← Pydantic request/response
  ├── routers/          ← API endpoints
  ├── services/         ← Business logic
  ├── core/
  │   ├── security.py   ← JWT, password hash
  │   └── exceptions.py ← custom errors
  └── db/
      └── database.py   ← SQLAlchemy setup

Minimal Stack:
  fastapi, uvicorn, sqlalchemy, psycopg2, alembic, pydantic, python-jose, passlib
```

---

## 🌐 API Endpoints Quick Map

### Authentication
```
POST   /auth/login                 → login & get tokens
POST   /auth/register              → admin daftar user
POST   /auth/refresh-token         → refresh access token
POST   /auth/change-password       → ganti password
GET    /auth/me                    → get current user
```

### Master Data (CRUD)
```
GET/POST   /programs
GET/POST   /pelajaran
GET/POST   /siswa
GET/POST   /soal
GET/POST   /paket-ujian
GET/POST   /jadwal-ujian
```

### Core Ujian Engine (CRITICAL)
```
POST   /ujian-siswa/mulai          → start exam (generate random)
GET    /ujian-siswa/{id}/soal/{no} → fetch soal (dengan urutan konsisten)
GET    /ujian-siswa/{id}/sisa-waktu → get timer from backend
POST   /ujian-siswa/{id}/jawab     → autosave jawaban
GET    /ujian-siswa/{id}/state     → resume ujian after refresh
POST   /ujian-siswa/{id}/submit    → submit ujian
POST   /ujian-siswa/{id}/log-kecurangan → log suspicious activity
```

### Results & Analytics
```
GET    /hasil-ujian/{id}           → siswa lihat hasil
GET    /hasil-ujian                → guru/admin lihat semua
GET    /dashboard/*                → monitoring & analytics
```

---

## 💻 Frontend Components (Phase 8+)

```
Auth Pages:
  - Login (siswa & guru)
  - Register (admin only)

Admin/Guru Panel:
  - CRUD program
  - CRUD pelajaran
  - CRUD soal (with rich text + KaTeX editor)
  - CRUD paket ujian
  - CRUD jadwal ujian
  - Dashboard monitoring

Siswa Panel:
  - Jadwal ujian list
  - Exam room (timer, soal, autosave indicator)
  - Hasil ujian (scores, breakdown)

Key Libraries:
  - Next.js (framework)
  - Tailwind (CSS)
  - TipTap (rich text)
  - KaTeX (math rendering)
  - Axios (HTTP client)
  - react-datepicker (date picker)
```

---

## 🧪 Testing Strategy (Phase 9)

### Unit Tests
```python
# test_scoring.py       → scoring logic
# test_timer.py         → timer calculation
# test_random.py        → random urutan
# test_auth.py          → JWT & login
```

### Integration Tests
```
Flow: login → lihat jadwal → mulai ujian → autosave → 
      refresh → resume → submit → lihat hasil
```

### Manual Testing (CRITICAL for Phase 5)
```
✅ Refresh di tengah ujian → lanjut normal
✅ Putus internet 2 menit → reconnect lanjut
✅ Waktu habis saat mengerjakan → auto-submit
✅ Login 2 device → detect kecurangan
✅ F12 console tidak bisa modify timer
```

### Load Testing
```
Scenario: 100 siswa login + 50 siswa ujian bersamaan
Tools: Locust, Apache JMeter
Target: response time < 500ms, CPU < 70%
```

---

## 📈 Key Metrics

```
Backend Performance:
  - API response time: < 500ms
  - Database query: < 100ms
  - Autosave success rate: > 99%
  - Timer accuracy: ±1 detik

Frontend Performance:
  - Page load: < 2 detik
  - Soal render: < 500ms
  - Autosave UI: instant feedback

System Reliability:
  - Uptime: > 99.9%
  - Data loss: 0%
  - Test pass rate: > 95%
```

---

## 🔄 Data Flow: Ujian Lengkap

```
1. MULAI UJIAN
   POST /ujian-siswa/mulai
   ↓ Backend: random soal + opsi, save to DB
   ← Response: ujian_id, soal_urutan, sisa_waktu

2. LIHAT SOAL
   GET /ujian-siswa/{id}/soal/1
   ↓ Backend: ambil soal + opsi from saved urutan
   ← Response: soal_id, teks, opsi (urutan konsisten!)

3. PILIH JAWABAN (setiap 5-10s)
   POST /ujian-siswa/{id}/jawab {soal_id, opsi_id}
   ↓ Backend: UPSERT jawaban_siswa
   ← Response: saved ✓

4. CEK TIMER (setiap 5s)
   GET /ujian-siswa/{id}/sisa-waktu
   ↓ Backend: hitung dari DB (durasi - elapsed time)
   ← Response: sisa_detik (e.g., 1234)

5. REFRESH / DISCONNECT → RESUME
   GET /ujian-siswa/{id}/state
   ↓ Backend: ambil urutan + jawaban tersimpan + hitung sisa_waktu
   ← Response: full state untuk resume

6. SUBMIT UJIAN
   POST /ujian-siswa/{id}/submit
   ↓ Backend: mark status=submitted, hitung skor (Phase 6)
   ← Response: submitted ✓

7. LIHAT HASIL
   GET /hasil-ujian/{id}
   ← Response: skor_total, skor_per_pelajaran, is_lulus
```

---

## 🚀 Quick Setup Commands

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # edit .env
uvicorn app.main:app --reload
# http://localhost:8000/docs
```

### Database
```bash
psql -U postgres
CREATE DATABASE cbt_quantum_research_dev;
CREATE USER cbt_user WITH PASSWORD 'dev_password_123';
GRANT ALL PRIVILEGES ON DATABASE cbt_quantum_research_dev TO cbt_user;
```

### Frontend (Phase 8+)
```bash
cd frontend
npm install
cp .env.example .env.local  # edit .env.local
npm run dev
# http://localhost:3000
```

---

## ⚠️ Critical DO's & DON'Ts

### DO ✅
```
✅ Mulai dari Phase 0 persiapan
✅ Simpan urutan soal & opsi ke DB (jangan regenerate)
✅ Hitung timer dari backend
✅ Autosave every 5-10 detik
✅ Test ekstensif Fase 5 (mesin ujian)
✅ Backup database regular
✅ Commit ke Git frequently
✅ Write tests untuk critical logic
✅ UAT dengan user asli sebelum go-live
```

### DON'T ❌
```
❌ Jangan skip Phase 0
❌ Jangan hitung timer di client
❌ Jangan regenerate random urutan saat refresh
❌ Jangan simpan password plain text
❌ Jangan deploy tanpa HTTPS
❌ Jangan skip backup database
❌ Jangan hard-code magic numbers
❌ Jangan skip UAT
```

---

## 📖 Documentation Files

```
docs/
├── README.md                    ← Project overview (5 min read)
├── ROADMAP.md                   ← Detail 10 phases (READ THIS!)
├── ARCHITECTURE.md              ← System design & flows
├── DATABASE.md                  ← Schema & relationships
├── PHASE_0_CHECKLIST.md         ← Konkret action items
└── PROGRESS_TRACKER.md          ← Weekly status tracking

Root Files:
├── START_HERE.md                ← Untuk pemula (first time? read this)
├── GETTING_STARTED.md           ← Step-by-step setup
└── QUICK_REFERENCE.md           ← File ini
```

---

## 🔗 Useful Links

```
FastAPI:      https://fastapi.tiangolo.com/
SQLAlchemy:   https://www.sqlalchemy.org/
PostgreSQL:   https://www.postgresql.org/docs/
React:        https://react.dev/
Next.js:      https://nextjs.org/docs
JWT:          https://jwt.io/
KaTeX:        https://katex.org/
```

---

## 🎯 This Week's Goals

```
☐ Commit work tree saat ini (13 modified + 4 untracked)
☐ Exam room: /siswa/ujian/[id] (timer, soal, autosave, submit)
☐ /siswa/ujian-aktif & /siswa/riwayat
☐ Protected route global / role guard
☐ Integration testing student flow
```

---

## 📞 Contact

- **PM/Product:** [TBD]
- **Backend Lead:** Rayhan Tama
- **Frontend Lead:** [TBD]

---

**Last Updated:** 2026-08-19  
**Next Review:** Weekly  
**📌 Detail lengkap & status terkini:** lihat [AI_HANDOFF.md](./AI_HANDOFF.md) — untuk AI berikutnya wajib baca ini dulu.

---

## Status: Exam Room & Student Pages (COMMITTED b9e2fdd)

```
☑ Semua halaman siswa dibuat (exam room, ujian-aktif, riwayat, hasil)
☑ Backend endpoints ujian lengkap & terpakai di frontend
☑ Exam room functional (timer backend, autosave, resume, submit, anti-cheat)
☑ Role guard global diterapkan (admin & siswa layout)
☑ KaTeX math rendering (MathContent)
☑ Build frontend sukses (npm run build, 19 route)
☐ Phase 9: integration & disruption testing  ← BERIKUTNYA
☐ Input-rumus UX (paste MathType → LaTeX)
```
