# 👋 START HERE — CBT Quantum Research

> Update 16 September 2026: acuan terkini ada di
> [Progress Tracker](docs/PROGRESS_TRACKER.md) dan [laporan QA](docs/QA_REPORT.md).
> Backend: 49 tes lolos; TypeScript dan build frontend lolos. Ringkasan persentase
> di bawah merupakan riwayat lama, bukan hasil audit terbaru.

Welcome! Ini adalah project CBT (Computer Based Test) untuk Bimbel Quantum Research.

Apakah Anda:
- **KILO / AI berikutnya yang akan lanjut kerja?** → Baca **[AI_HANDOFF.md](./AI_HANDOFF.md)** — snapshot status paling akurat & prioritas selanjutnya (WAJIB baca!)
- **Baru pertama kali lihat project ini?** → Baca section "📖 Untuk Pemula" di bawah
- **Sudah pernah coding, langsung mau setup?** → Baca [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Mau tahu detail roadmap?** → Baca [docs/ROADMAP.md](./docs/ROADMAP.md)
- **Mau tahu status terkini?** → Baca [docs/PROGRESS_TRACKER.md](./docs/PROGRESS_TRACKER.md)
- **Mau mulai ngoding frontend?** → Baca [PHASE_3_FRONTEND.md](./docs/PHASE_3_FRONTEND.md)

---

## 📖 Untuk Pemula: 5 Menit Overview

### Apa Itu Project Ini?

Ini adalah aplikasi web untuk mengadakan **ujian online** di bimbel. Fitur utama:

✅ Siswa bisa login & mengerjakan ujian  
✅ Guru bisa input soal & lihat hasil siswa  
✅ Ujian punya timer yang aman (dihitung dari server)  
✅ Jawaban tersimpan otomatis (aman dari kehilangan data)  
✅ Bisa lanjut ujian setelah refresh / internet terputus  

### Tech Stack

```
🔧 Backend: FastAPI (Python web framework) + PostgreSQL (database)
🎨 Frontend: React/Next.js (website user interface)
🔐 Auth: JWT (login tokens)
```

### Project Status

```
📊 Backend MVP (Phase 1-7): ✅ 100% complete (+ Grouping Tryout)
📊 Frontend Admin CRUD (Phase 3): ✅ 100% complete (Quantum design system)
📊 Frontend Auth + CRUD lanjutan: ✅ Login, Kelas, Users, Soal+Opsi+RichEditor (committed)
📊 Frontend Student Pages (Phase 8): ✅ ~90% (dashboard, jadwal, exam room, ujian-aktif, riwayat, hasil done)
📊 Math rendering: ✅ KaTeX aktif (MathContent) — input-rumus UX belum tuntas
📊 Overall Progress: ~88% end-to-end
📅 Estimasi timeline: 4-5 bulan untuk solo developer
⏱️ Target go-live: November 2026
```

### File Yang Harus Dibaca (dalam urutan)

0. **KILO/AI yang ingin lanjut?** → Baca **[AI_HANDOFF.md](./AI_HANDOFF.md)** — status terkini (committed) + prioritas berikutnya
1. **Anda sekarang:** File `START HERE` ini
2. **[docs/PROGRESS_TRACKER.md](./docs/PROGRESS_TRACKER.md)** — Status terkini (5 min)
3. **[README.md](./README.md)** — Project overview singkat (5 min)
4. **[docs/ROADMAP.md](./docs/ROADMAP.md)** — Detail 10 phases (30 min)
5. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Cara kerja sistem (30 min)
6. **[docs/DATABASE.md](./docs/DATABASE.md)** — Schema tabel (20 min)
7. **[GETTING_STARTED.md](./GETTING_STARTED.md)** — Setup lokal (15 min)
8. **[docs/PHASE_3_FRONTEND.md](./docs/PHASE_3_FRONTEND.md)** — Panduan frontend design system (10 min)

---

## 🎯 Yang Perlu Anda Ketahui

### Fase Pengerjaan (10 Fase)

| # | Nama | Durasi | Status |
|---|------|--------|--------|
| 0 | Persiapan | 1 minggu | 🟡 89% (branding pending) |
| 1 | Backend & Database | 1-2 minggu | ✅ Complete |
| 2 | Authentication | 1 minggu | ✅ Complete |
| 3 | CRUD Soal & Paket | 1-2 minggu | ✅ Complete |
| 4 | Jadwal Ujian | 3-5 hari | ✅ Complete |
| 5 | **Mesin Ujian** ⭐ | 2-3 minggu | ✅ Complete (core + exam room; disruption test → Phase 9) |
| 6 | Scoring & Hasil | 1 minggu | ✅ Complete |
| 7 | Dashboard & Monitoring | 1-2 minggu | ✅ Complete (+ Grouping Tryout) |
| 8 | Frontend Lengkap | 3-4 minggu | 🟡 ~90% (Admin CRUD + Auth + Student pages + KaTeX + RoleGuard) |
| 9 | Testing & QA | 2 minggu | 🔴 Belum mulai (fokus berikutnya) |
| 10 | Deployment Go-Live | 3-5 hari | 🔴 Belum mulai |

**⭐ Fase 5 (Mesin Ujian) adalah yang PALING PENTING** — jangan hurry-hurry di sini!

---

## 🚀 Quick Start (untuk developer)

### Minimum 15 Minutes Setup

1. **Install tools** (jika belum):
   - Python 3.10+ → [download](https://www.python.org/)
   - PostgreSQL → [download](https://www.postgresql.org/)
   - Git → [download](https://git-scm.com/)
   - Node.js → [download](https://nodejs.org/)

2. **Buka terminal, setup backend:**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```

3. **Setup database:**
   ```bash
   # Open PostgreSQL client
   psql -U postgres
   
   # Run:
   CREATE DATABASE cbt_quantum_research_dev;
   ```

4. **Copy .env template:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env sesuai database Anda
   ```

5. **Run backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   # Buka: http://localhost:8000/docs
   ```

Done! Backend ready.

---

## 📂 Folder Structure

```
CBT/
├── backend/              # FastAPI (Python)
│   ├── app/
│   │   ├── main.py       # Entry point
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Request/response schemas
│   │   ├── routers/      # API endpoints
│   │   └── services/     # Business logic
│   ├── migrations/       # Alembic database migrations
│   ├── requirements.txt  # Python dependencies
│   ├── .env.example      # Environment template
│   └── .gitignore
│
├── frontend/             # React/Next.js (Phase 8 — ~50% complete)
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable UI components
│   ├── lib/              # API client, auth, types
│   ├── package.json
│   └── .env.example
│
├── docs/                 # Documentation
│   ├── README.md         # Project overview
│   ├── ROADMAP.md        # Lengkap 10 phases (BACA INI!)
│   ├── ARCHITECTURE.md   # System design
│   ├── DATABASE.md       # Schema
│   ├── PROGRESS_TRACKER.md
│   ├── PHASE_0_CHECKLIST.md
│   ├── PHASE_3_FRONTEND.md
│   └── PANDUAN_GRUP_TRYOUT.md
│
├── README.md             # Main project readme
├── GETTING_STARTED.md    # Setup guide
├── START_HERE.md         # File ini
├── PHASE_3_FRONTEND_SUMMARY.md
├── QUICK_REFERENCE.md
├── AI_HANDOFF.md             # ✅ BACA INI untuk AI berikutnya (status & prioritas)
└── IMPLEMENTASI_GRUP_TRYOUT_FINAL.md
```

---

## 🎓 Key Concepts (Important!)

### 1. Random Urutan Soal & Opsi

```
PROBLEM: Siswa bisa lihat soal & jawaban siswa lain dari monitor sebelah

SOLUTION:
- Setiap siswa dapat urutan soal BERBEDA (random)
- Pilihan jawaban juga di-random
- Urutan ini DISIMPAN ke database (bukan dihitung ulang)
- Jika siswa refresh, urutan SAMA PERSIS

Contoh:
  Siswa A: [Soal 45, 12, 89, 34] dengan opsi [B, D, A, C]
  Siswa B: [Soal 89, 34, 45, 12] dengan opsi [C, B, D, A]
```

### 2. Timer dari Backend (Bukan Client)

```
PROBLEM: Client bisa manipulasi timer (buka console → pause timer)

SOLUTION:
- Timer dihitung di server: sisa_waktu = durasi - (sekarang - waktu_mulai)
- Client hanya menampilkan (setiap 5 detik ambil dari server)
- Bahkan kalau client spoof, server tidak peduli

Keamanan: ✅ TINGGI
```

### 3. Autosave Jawaban

```
FLOW:
1. Siswa pilih jawaban
2. Frontend: send jawaban ke server (dalam batch, setiap 5-10 detik)
3. Server: UPSERT ke database (insert atau update)
4. Frontend: show "Tersimpan ✓"

Keuntungan:
- User merasa aman (jawaban tersimpan)
- Efficient (batch, bukan per jawaban)
- Tahan refresh / disconnect internet
```

### 4. Resume Ujian

```
FLOW:
1. Siswa sedang ujian, browser refresh / internet putus
2. Frontend: call GET /ujian/{id}/state
3. Server: return:
   - Urutan soal yang sudah di-random (tersimpan)
   - Jawaban yang sudah disimpan
   - Sisa waktu
4. Frontend: restore state, user lanjut seperti normal

Hasil: Siswa tidak perlu khawatir kehilangan progress
```

---

## ✅ Current Focus — Phase 8 Frontend (Student Pages)

Status pekerjaan (update 2026-08-19):

- [x] Quantum Research design system (Tailwind + reusable components)
- [x] Admin CRUD pages (Program, Pelajaran, Kelas, Siswa, Paket, Soal, Jadwal, Users)
- [x] Admin dashboard + navigation (role-aware) + logout
- [x] Auth flow (login, role redirect, getUser, logout) — `lib/auth.ts`
- [x] RichEditor + manajemen opsi jawaban di halaman soal
- [x] Student dashboard + jadwal ujian page
- [x] **Active exam interface** (`/siswa/ujian/[id]`: timer backend, navigasi soal, autosave, submit, anti-cheat)
- [x] `/siswa/ujian-aktif`, `/siswa/riwayat`, `/siswa/hasil/[id]`
- [x] Protected route global (`RoleGuard` di admin & siswa layout)
- [x] KaTeX math rendering (`MathContent`)
- [ ] Input-rumus UX (paste MathType/Word → LaTeX) — belum tuntas
- [ ] Refresh-token auto-handling saat 401 (opsional)
- [ ] Integration testing student flow (Phase 9)

**✅ Semua fitur di atas sudah di-commit** (commit `b9e2fdd`). Bacalah **[AI_HANDOFF.md](./AI_HANDOFF.md)** untuk detail & prioritas selanjutnya.

**Target:** Fondasi student pages + exam room selesai → lanjut **Phase 9 (Testing & QA)**.

---

## 🤔 Common Questions

**Q: Berapa lama project ini selesai?**  
A: ~4-5 bulan untuk solo developer. Bisa lebih cepat jika ada team.

**Q: Bagian mana yang paling rumit?**  
A: Fase 5 (Mesin Ujian) — random soal, timer, autosave, resume. Jangan skip atau kurangi kualitas di sini.

**Q: Bisakah saya mulai dari Fase 8 (Frontend)?**  
A: Sebaiknya tidak. Mulai dari Fase 1 agar API backend ready. Frontend bisa dimulai paralel setelah Fase 3.

**Q: Perlu belajar apa dulu?**  
A: FastAPI (Python web framework), SQLAlchemy (ORM), React/Next.js (frontend).

**Q: Database production pakai apa?**  
A: PostgreSQL (sama dengan local dev). Deploy di VPS atau managed DB service.

---

## 📞 Next Steps

1. **Hari ini:** Baca file ini + **[AI_HANDOFF.md](./AI_HANDOFF.md)** (khusus AI yang lanjut kerja)
2. **Jika baru setup:** Ikuti [GETTING_STARTED.md](./GETTING_STARTED.md)
3. **Status:** Backend + student pages (exam room) + KaTeX sudah selesai & di-commit
4. **Prioritas tertinggi:** Phase 9 — Testing & QA (integration + disruption test alur ujian)
5. **Sisa polish:** input-rumus UX (paste MathType→LaTeX), refresh-token 401, responsive

---

## 🎯 Tujuan Akhir

Membuat sistem CBT yang:
✅ **Stabil** — tidak crash / data hilang  
✅ **Aman** — timer & jawaban tidak bisa dimanipulasi  
✅ **User-friendly** — mudah dipakai guru & siswa  
✅ **Scalable** — bisa handle ratusan siswa ujian bersamaan  

---

## 📚 Resource Links

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy Docs:** https://www.sqlalchemy.org/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **React Docs:** https://react.dev/
- **Next.js Docs:** https://nextjs.org/docs

---

## ✨ Selamat! 

Anda sudah tahu apa yang harus dikerjakan. Sekarang:

👉 **Backend + student pages (exam room) + KaTeX siap — fokus berikutnya: Phase 9 Testing & QA**  
👉 **Khusus AI: baca [AI_HANDOFF.md](./AI_HANDOFF.md) untuk status & prioritas termutakhir**  
👉 **Ikuti [GETTING_STARTED.md](./GETTING_STARTED.md) untuk setup lokal**  
👉 **Lihat [docs/PROGRESS_TRACKER.md](./docs/PROGRESS_TRACKER.md) untuk status terkini**  
👉 **Baca [PHASE_3_FRONTEND.md](./docs/PHASE_3_FRONTEND.md) untuk panduan design system**

**Good luck! Let's build something awesome! 🚀**

---

**Last Updated:** 2026-08-19  
**For More Info:** Baca **[AI_HANDOFF.md](./AI_HANDOFF.md)** (untuk AI) atau folder `docs/`
