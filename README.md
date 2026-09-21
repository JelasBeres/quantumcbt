# 🎯 Sistem CBT Quantum Research

**Proyek:** Aplikasi Computer Based Test untuk Bimbel Quantum Research  
**Stack:** FastAPI + PostgreSQL + React/Next.js  
**Status:** Fitur utama tersedia; QA lokal sedang diverifikasi. Lihat [Progress Tracker](./docs/PROGRESS_TRACKER.md) dan [laporan QA](./docs/QA_REPORT.md).

---

## 📋 Ringkasan Proyek

Sistem CBT online untuk menunjang kegiatan bimbel offline Quantum Research. Fokus utama:
- ✅ Backend stabil dan aman
- ✅ Frontend sederhana tapi user-friendly
- ✅ Support ujian dengan randomisasi soal/jawaban
- ✅ Autosave & resume ujian (tahan refresh/putus internet)
- ✅ Timer terhitung dari server (tidak bisa dimanipulasi client)

**Program yang didukung:**
- Kelas 12: TKA, SNBT, Speedtest, Ujian Mandiri
- SMP: TKA, Speedtest

---

## 📂 Struktur Folder

```
CBT/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # Business logic
│   │   └── core/           # Auth, config, etc
│   └── requirements.txt
├── frontend/                # Next.js frontend (App Router)
│   ├── app/                # Pages (admin/, siswa/, login)
│   ├── components/         # Design system + RichEditor
│   ├── lib/                # api.ts, auth.ts, types
│   └── package.json
├── docs/
│   ├── ROADMAP.md          # Roadmap lengkap (fase 0-10)
│   ├── ARCHITECTURE.md     # Arsitektur sistem
│   ├── DATABASE.md         # Spesifikasi database
│   └── PROGRESS_TRACKER.md # Status terkini
├── docs/PROGRESS_TRACKER.md           # Snapshot status untuk AI berikutnya (BACA!)
└── README.md               # File ini
```

---

## 🚀 Mulai dari Mana?

### ✅ **Langkah 1: Baca Roadmap & Dokumentasi**
- Lihat [ROADMAP.md](./docs/ROADMAP.md) untuk overview lengkap
- Lihat [ARCHITECTURE.md](./docs/ARCHITECTURE.md) untuk desain sistem

### ✅ **Langkah 2: Siapkan Environment (Fase 0)**
1. **Setup Python Backend**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Setup Database PostgreSQL**
   - Install PostgreSQL lokal
   - Buat database: `cbt_quantum_research`

3. **Setup Frontend Node.js** (nanti, setelah API basic ready)
   ```bash
   cd frontend
   npm install
   ```

### ✅ **Langkah 3: Fase 1 - Backend Setup**
Lihat [PHASE_0_CHECKLIST.md](./docs/PHASE_0_CHECKLIST.md) untuk checklist lengkap Fase 0.

---

## 📊 Estimasi Timeline

| Fase | Deskripsi | Estimasi awal | Status audit 16 September 2026 |
|------|-----------|---------------|-------------------------------|
| 0 | Persiapan & Setup | 1 minggu | Lokal berjalan; finalisasi branding belum dikonfirmasi |
| 1 | Backend & Database | 1-2 minggu | Model/API tersedia; migrasi PostgreSQL perlu diverifikasi |
| 2 | Authentication | 1 minggu | Implementasi tersedia; bug waktu dan logout diperbaiki |
| 3 | CRUD Master Data | 1-2 minggu | Implementasi dan tes API tersedia |
| 4 | Jadwal Ujian | 3-5 hari | Implementasi dan tes workflow tersedia |
| 5 | Mesin Ujian | 2-3 minggu | Tes API tersedia; pengujian gangguan browser masih terbuka |
| 6 | Scoring & Hasil | 1 minggu | Implementasi dan tes API tersedia |
| 7 | Dashboard & Monitoring | 1-2 minggu | Implementasi dan tes API tersedia |
| 8 | Frontend Lengkap | 3-4 minggu | TypeScript/build lolos; QA responsif dan paste rumus tersisa |
| 9 | Testing & QA | 2 minggu | Sedang dikerjakan; lihat hasil aktual di Progress Tracker |
| 10 | Deployment | 3-5 hari | Belum diverifikasi; server, HTTPS, backup, dan UAT tersisa |

**Total: ~16-20 minggu (4-5 bulan) untuk solo dev, atau 3-3.5 bulan jika parallel.**

---

## 🎯 Prioritas Pengerjaan

Urutan yang paling kritis agar cepat punya MVP yang bisa ditest:

1. ⭐ **Setup backend + DB** → API bisa berjalan
2. ⭐ **Auth (login/register)** → User bisa login
3. ⭐ **CRUD soal & paket ujian** → Guru bisa input soal
4. ⭐⭐ **Mesin ujian (random, timer, autosave, resume)** → **JANTUNG SISTEM**
5. ⭐ **Scoring** → Nilai muncul otomatis

Baru setelah 5 poin di atas stabil → lanjut dashboard, frontend cantik, fitur tambahan.

---

## 📚 Dokumentasi Utama

- [📖 ROADMAP.md](./docs/ROADMAP.md) — Roadmap fase 0-10 lengkap
- [🏗️ ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Desain sistem & flow
- [🗄️ DATABASE.md](./docs/DATABASE.md) — Spesifikasi tabel & relasi
- [✅ PHASE_0_CHECKLIST.md](./docs/PHASE_0_CHECKLIST.md) — Checklist Fase 0

---

## 💡 Tech Stack

**Backend:**
- FastAPI (framework)
- PostgreSQL (database)
- SQLAlchemy (ORM)
- Alembic (migration)
- Pydantic (validation)
- PyJWT (authentication)

**Frontend:**
- React / Next.js
- Tailwind CSS (styling)
- Axios (HTTP client)
- KaTeX / MathJax (render rumus)
- TipTap / Quill (rich text editor)

---

## 📝 Catatan Penting

1. **Fase 5 (Mesin Ujian) adalah yang paling kritis** — jangan hurry-hurry di sini.
2. **Random soal & jawaban harus disimpan ke DB** — supaya konsisten saat refresh.
3. **Timer dari backend** — client hanya menampilkan, tidak menghitung.
4. **Autosave every 5-10 detik** — user bisa merasa aman.
5. **Testing ekstensif** — terutama skenario refresh & disconnect.

---

## 🤝 Kontribusi

Proyek ini dikerjakan untuk Quantum Research. Silakan ikuti struktur dan dokumentasi yang sudah disiapkan.

---

**Last Updated:** 2026-09-16  
**Project Lead:** Rayhan Tama  
**Status:** QA lokal berlangsung; status aktual tersedia di [Progress Tracker](./docs/PROGRESS_TRACKER.md).
