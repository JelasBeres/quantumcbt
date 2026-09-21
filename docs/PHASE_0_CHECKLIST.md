# ✅ FASE 0 — Persiapan (Checklist Konkret)

**Durasi:** 1 minggu  
**Tujuan:** Siapkan pondasi sebelum mulai coding.

---

## 1️⃣ Branding & Dokumentasi Bisnis

- [ ] **Finalisasi nama:** Quantum Research CBT System / QuantumCBT / Quantum Test System?
- [ ] **Pilih warna utama:** (suggestion: biru professional, misal #0066CC atau #003366)
- [ ] **Buat logo simple** (atau gunakan yang sudah ada dari Quantum Research)
- [ ] **Tentukan domain:**
  - Production: `cbt.quantumresearch.id` atau `exam.quantumresearch.id`?
  - Staging: `staging-cbt.quantumresearch.id`?
  - Dev: `dev-cbt.local`
  
- [ ] **Dokumentasi:**
  - [ ] Daftar semua stakeholder (pemilik, guru, siswa)
  - [ ] Business requirements doc
  - [ ] User personas (guru, siswa kelas 12, siswa SMP)

---

## 2️⃣ Repository & Version Control

- [ ] **Buat GitHub/GitLab account** (jika belum)
- [ ] **Setup repository:**
  - [ ] Backend repo: `quantum-research-cbt-backend` (private)
  - [ ] Frontend repo: `quantum-research-cbt-frontend` (private)
  - [ ] Atau monorepo: `quantum-research-cbt` dengan subfolder `/backend` dan `/frontend`

- [ ] **Branching strategy:**
  - [ ] `main` — production
  - [ ] `develop` — development
  - [ ] `feature/*` — fitur baru
  - [ ] `bugfix/*` — bug fix

- [ ] **Setup .gitignore:**
  ```
  # Backend
  venv/
  __pycache__/
  *.pyc
  .env
  .env.local
  .vscode/
  *.db
  migrations/versions/  # optional, biasanya tracked

  # Frontend
  node_modules/
  .next/
  dist/
  .env.local
  .env.production.local
  ```

---

## 3️⃣ Local Environment Setup

### 3.1 Python Backend Environment

**OS:** Windows (Anda pakai Windows)

1. **Install Python 3.10+**
   ```bash
   python --version  # harus 3.10 atau lebih tinggi
   ```

2. **Setup virtual environment**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # di Windows
   ```

3. **Install tools dasar**
   ```bash
   pip install --upgrade pip
   pip install poetry  # atau tetap pakai pip + requirements.txt
   ```

4. **Buat requirements.txt** (minimal untuk Phase 1):
   ```
   fastapi==0.104.1
   uvicorn==0.24.0
   sqlalchemy==2.0.23
   psycopg2-binary==2.9.9  # PostgreSQL driver
   alembic==1.13.0
   pydantic==2.5.0
   pydantic-settings==2.1.0
   python-jose[cryptography]==3.3.0
   passlib[bcrypt]==1.7.4
   python-multipart==0.0.6
   pytest==7.4.3
   pytest-asyncio==0.21.1
   ```

5. **Install requirements**
   ```bash
   pip install -r requirements.txt
   ```

### 3.2 PostgreSQL Database

**Install PostgreSQL:**
- Download dari [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
- Install dengan default settings
- Username default: `postgres`, password: set saat install
- Default port: 5432

**Buat database lokal:**
```sql
-- Connect sebagai postgres
psql -U postgres

-- Create database
CREATE DATABASE cbt_quantum_research_dev;

-- Create user (opsional, untuk dev)
CREATE USER cbt_user WITH PASSWORD 'dev_password_123';
ALTER ROLE cbt_user SET client_encoding TO 'utf8';
ALTER ROLE cbt_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE cbt_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE cbt_quantum_research_dev TO cbt_user;

-- Verify
\l  -- list databases
\du -- list users
```

**Test connection:**
```bash
psql -h localhost -U cbt_user -d cbt_quantum_research_dev -c "SELECT 1"
```

### 3.3 Node.js & Frontend Environment

**Install Node.js:**
- Download dari [https://nodejs.org/](https://nodejs.org/) (LTS)
- Verify:
  ```bash
  node --version
  npm --version
  ```

**Setup Next.js template** (nanti di Phase 8):
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint
npm install axios
npm install katex react-katex
npm install react-datepicker
```

---

## 4️⃣ Development Tools & IDE

- [ ] **VS Code** — already punya
  - [ ] Extension: Python, Pylance
  - [ ] Extension: ES7+ React/Redux/React-Native snippets
  - [ ] Extension: Thunder Client (untuk test API)
  - [ ] Extension: Database Client (untuk browse DB)

- [ ] **Database GUI** (pick one):
  - [ ] DBeaver (free, powerful)
  - [ ] pgAdmin (free, PostgreSQL specific)
  - [ ] DataGrip (paid, tapi powerful)

- [ ] **API Testing Tool**:
  - [ ] Postman (web/desktop)
  - [ ] Thunder Client (di VS Code)
  - [ ] Insomnia (lightweight)

- [ ] **Git GUI** (opsional, tambahan):
  - [ ] GitHub Desktop
  - [ ] Sourcetree

---

## 5️⃣ Documentation & Architecture

### 5.1 Entity Relationship Diagram (ERD)

**Tools:** Lucidchart, Draw.io, atau DbDesigner

**Tabel & Relasi:**

```
users (id, username, password_hash, role, created_at, updated_at)
  ├── 1 : N → siswa
  ├── 1 : N → sesi_login
  └── 1 : N → log_kecurangan

siswa (id, user_id, nama_lengkap, no_induk, program_id)
  ├── N : 1 → users
  ├── N : 1 → program
  ├── 1 : N → ujian_siswa
  └── 1 : N → sesi_login

program (id, nama, deskripsi)
  ├── 1 : N → siswa
  ├── 1 : N → pelajaran
  ├── 1 : N → paket_ujian
  └── 1 : N → kelas

pelajaran (id, nama, program_id)
  ├── N : 1 → program
  └── 1 : N → soal

kelas (id, nama, level, program_id)
  ├── N : 1 → program
  └── 1 : N → jadwal_ujian

paket_ujian (id, nama, program_id, durasi_menit, jumlah_soal)
  ├── N : 1 → program
  ├── 1 : N → soal
  └── 1 : N → jadwal_ujian

soal (id, paket_ujian_id, pelajaran_id, teks_soal, tipe)
  ├── N : 1 → paket_ujian
  ├── N : 1 → pelajaran
  ├── 1 : N → opsi_jawaban
  └── 1 : N → jawaban_siswa

opsi_jawaban (id, soal_id, teks_opsi, is_benar, urutan)
  ├── N : 1 → soal
  └── 1 : N → jawaban_siswa

jadwal_ujian (id, paket_ujian_id, kelas_id, waktu_mulai, waktu_selesai)
  ├── N : 1 → paket_ujian
  ├── N : 1 → kelas
  └── 1 : N → ujian_siswa

ujian_siswa (id, siswa_id, jadwal_ujian_id, status, waktu_mulai, waktu_selesai)
  ├── N : 1 → siswa
  ├── N : 1 → jadwal_ujian
  ├── 1 : N → jawaban_siswa
  ├── 1 : N → hasil_ujian
  └── 1 : N → log_kecurangan

jawaban_siswa (id, ujian_siswa_id, soal_id, opsi_jawaban_id, diacak_urutan_soal_json)
  ├── N : 1 → ujian_siswa
  ├── N : 1 → soal
  └── N : 1 → opsi_jawaban

hasil_ujian (id, ujian_siswa_id, skor_total, skor_per_pelajaran_json)
  └── N : 1 → ujian_siswa

log_kecurangan (id, ujian_siswa_id, tipe, deskripsi, created_at)
  └── N : 1 → ujian_siswa

sesi_login (id, siswa_id, device_id, ip_address, login_time, logout_time)
  └── N : 1 → siswa

pengaturan (id, kunci, nilai_json)
```

**Buat diagram ini** menggunakan tool favorit Anda, export sebagai PNG/SVG → simpan di `docs/erd.png`

### 5.2 API Architecture Document

Buat file `docs/ARCHITECTURE.md` dengan isi:

- Overview system (request flow)
- Authentication flow (JWT)
- Exam engine architecture (random soal, timer, autosave)
- Database design rationale
- Error handling strategy

---

## 6️⃣ Team & Role Definition

Tentukan role akun untuk sistem:

| Role | Deskripsi | Permissions |
|------|-----------|-------------|
| `admin` | Admin sistem, manage guru & siswa | CRUD all, settings |
| `guru` | Guru, input soal & paket ujian | CRUD soal/paket, lihat hasil siswa, monitoring |
| `siswa` | Siswa, ambil ujian | Lihat jadwal, ambil ujian, lihat hasil sendiri |

**Permission Matrix:**

| Resource | Admin | Guru | Siswa |
|----------|-------|------|-------|
| Users | CRUD | R | R (self) |
| Program | CRUD | R | R |
| Pelajaran | CRUD | R | R |
| Soal | CRUD | CRUD | R |
| Paket Ujian | CRUD | CRUD | R |
| Jadwal Ujian | CRUD | R | R (own) |
| Ujian Siswa | R | R (filter by kelas) | R (own) |
| Hasil Ujian | R | R (filter by kelas) | R (own) |
| Dashboard | view all | view kelas own | view own |

---

## 7️⃣ Folder Structure Setup

**Backend:**
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # entry point FastAPI
│   ├── config.py               # settings, env vars
│   ├── dependencies.py         # dependency injection
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── siswa.py
│   │   ├── program.py
│   │   ├── soal.py
│   │   └── ... (semua tabel)
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py             # Pydantic schema
│   │   ├── siswa.py
│   │   └── ...
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py             # /auth endpoints
│   │   ├── program.py          # /program endpoints
│   │   ├── soal.py             # /soal endpoints
│   │   ├── ujian.py            # /ujian endpoints
│   │   └── ...
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── soal_service.py
│   │   ├── ujian_service.py    # logic ujian (random, timer, scoring)
│   │   └── ...
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py         # JWT, password hashing
│   │   ├── exceptions.py       # custom exceptions
│   │   └── constants.py        # constants
│   │
│   └── db/
│       ├── __init__.py
│       └── database.py         # SQLAlchemy setup
│
├── migrations/                  # Alembic migrations
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # pytest fixtures
│   ├── test_auth.py
│   ├── test_soal.py
│   └── ...
│
├── .env.example                # template env vars
├── requirements.txt
├── README.md
└── docker-compose.yml          # untuk local dev (optional phase 0)
```

**Frontend:**
```
frontend/
├── pages/
│   ├── _app.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── admin/
│   ├── guru/
│   ├── siswa/
│   └── api/  # Next.js API routes (optional)
├── components/
│   ├── Layout.tsx
│   ├── Navbar.tsx
│   └── ...
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── ...
├── styles/
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 8️⃣ Environment Variables Template

**Backend `.env.example`:**
```
# Database
DATABASE_URL=postgresql://cbt_user:dev_password_123@localhost:5432/cbt_quantum_research_dev

# JWT
SECRET_KEY=your-super-secret-key-change-this-in-production-12345
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Server
DEBUG=true
LOG_LEVEL=INFO

# Email (nanti untuk reset password)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=quantum.research@example.com
SMTP_PASSWORD=app_password_here
```

**Frontend `.env.example`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Quantum Research CBT
```

---

## 9️⃣ Dokumentasi untuk Developer

Buat file `docs/DEV_GUIDE.md`:

**Isi:**
- Setup lokal step-by-step
- Cara run backend (`uvicorn app.main:app --reload`)
- Cara run frontend (`npm run dev`)
- Cara run tests
- Commit message convention
- Code style & linting

---

## 🔟 Initial Git Commit

```bash
# Backend
cd backend
git init
git add .
git commit -m "Initial commit: project structure phase 0"
git branch -M main
git remote add origin https://github.com/your-org/quantum-cbt-backend.git
git push -u origin main

# Frontend (nanti)
# cd frontend
# git init
# ... (same pattern)
```

---

## ✅ Fase 0 Done Criteria

Checklist final — sebelum lanjut ke Fase 1:

- [ ] Repository Git siap (backend & frontend)
- [ ] Local environment siap (Python venv, PostgreSQL, Node.js)
- [ ] Database lokal buat dan konek test berjalan
- [ ] Folder structure sesuai rencana
- [ ] ERD dokumentasi lengkap
- [ ] Role & permission sudah defined
- [ ] .env template siap
- [ ] DEV_GUIDE dokumentasi siap
- [ ] Initial commit done

**Setelah checklist ✅ selesai → Lanjut ke FASE 1 (Backend & Database Setup)**

---

## 📝 Notes

- **Jangan skip persiapan!** Phase 0 ini walaupun cuma "admin" tapi sangat penting untuk smooth development nanti.
- **Dokumentasi adalah investasi** — spend waktu di sini akan save banyak waktu di fase-fase berikutnya.
- **Setup lokal environment yang bersih** — jangan mix dengan project lain.
- **Git branching discipline dari awal** — akan memudahkan kolaborasi (jika nanti ada tim).

---

**Expected Duration:** 3-5 hari (tidak perlu full 1 minggu)  
**Next Phase:** FASE 1 — Setup Backend & Database  
**Status:** 🟡 In Progress (atau 🔴 Not Started)

Siap lanjut ke Fase 1? → Cek [ROADMAP.md](./ROADMAP.md#-fase-1--setup-backend--database-12-minggu) untuk detail Fase 1.
