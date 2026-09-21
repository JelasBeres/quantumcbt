# Progress Tracker — CBT Quantum Research

## Pembaruan 19 September 2026 — UI siswa

Tambahan daftar master: pencarian siswa (nama, induk, sekolah, program, kelas),
program (nama/deskripsi), kelas, serta pelajaran (nama/program) telah ditambahkan.
Kelima daftar termasuk akun pengguna memakai paginasi 10/25/50 baris dan ID
terbaru di atas. Filter akun yang sudah ada tetap digunakan. Paginasi masih
di frontend; API masih mengambil seluruh data. TypeScript lokal lulus dan
kelima rute admin HTTP 200; interaksi browser belum diverifikasi.

Status saat ini: implementasi fitur utama dan pembaruan UI siswa tersedia di lokal;
Phase 8 masih menunggu verifikasi visual/responsif, Phase 9 sedang berjalan,
dan Phase 10 (deployment) belum selesai. Belum dinyatakan siap rilis.

- [x] Tema gelap siswa, banner biru–ungu, kartu Tryout, dan navigasi bawah mengambang mengikuti arah referensi client.
- [x] Topbar memakai tulisan **QUANTUM** dan aset logo Quantum proyek.
- [x] Background ikon Tryout, Latihan, dan menu lainnya navy polos dengan border lingkaran, termasuk ketika dipilih.
- [x] Menu beranda tetap terhubung ke Tryout, Latihan, jadwal, ujian aktif, riwayat, dan profil.
- [x] TypeScript dan smoke HTTP lima halaman siswa lulus saat pembaruan dashboard, sebelum penyesuaian kecil logo/ikon terakhir.
- [ ] Verifikasi visual browser pada ponsel dan desktop, termasuk penyesuaian logo/ikon terakhir.
- [ ] Uji alur siswa end-to-end, refresh/offline/reconnect, timer, drilling, dan hasil.
- [ ] UAT admin/guru/siswa serta persetujuan tampilan dari client.
- [ ] Perluasan filter/paginasi ke seluruh daftar master.
- [ ] Validasi migrasi PostgreSQL, uji beban, dan kesiapan deployment.

Penilaian biasa tetap digunakan. Skor kohort/IRT merupakan tahap lanjutan,
bukan fitur aktif. Tidak ada persentase keseluruhan baru tanpa audit checklist.
Hasil build/backend 18 September di bawah adalah bukti historis, bukan pengujian ulang UI terbaru.

## Pembaruan 18 September 2026

Drilling aktif tanpa timer; UTBK dapat kembali antar-mapel; penugasan paket guru
dan pembatasan admin diterapkan; revisi approved otomatis mengganti soal untuk
paket belum mulai; filter pembuat/tanggal soal dan periode jadwal ditambah.
Backend: **73 tes lulus**. Rincian dan uji browser:
[CLIENT_REQUESTS_2026-09-18.md](CLIENT_REQUESTS_2026-09-18.md).

## Pembaruan sebelumnya: 17 September 2026

Tahap lanjutan: Speedtest dihapus dari alur aktif; filter manual/bank soal/jadwal
ditambah; Latihan tanpa jadwal dan bisa diulang; riwayat hanya Tryout; perpindahan
mapel di halaman ujian dengan penguncian server; pilihan jurusan dikelola admin.
Suite backend lengkap 70 tes lulus, build frontend lulus, smoke API lokal lulus.
IRT dan drill belum diaktifkan karena definisinya belum diberikan.

Catatan verifikasi tahap sebelumnya:

- Timer ujian diperbaiki: UTC eksplisit dan verifikasi server sebelum submit otomatis.
- Revisi soal disetujui lintas guru sesuai penugasan, tetap memerlukan persetujuan admin.
- Edit pada Disetujui membuka draft revisi; daftar soal terbaru dahulu.
- Pemilihan otomatis campuran dengan jumlah mudah/sedang/sulit terpisah.
- Backend: **65 tes lulus**. TypeScript dan build produksi frontend: **lulus**.
- Browser interaktif belum diuji. Aturan IRT/drill masih menunggu client.
- Seluruh pekerjaan yang belum selesai tercatat di [acuan 17 September](CLIENT_REQUESTS_2026-09-17.md).

## Status terverifikasi sebelumnya: 16 September 2026

Tambahan kebutuhan client sedang dikerjakan di luar checklist roadmap lama.
Profil siswa (nama dan sekolah), form sekolah admin, serta perbaikan alur ganti
password sudah diimplementasikan. Rincian dan empat keputusan yang menunggu
client ada di [CLIENT_REQUESTS_2026-09-16.md](CLIENT_REQUESTS_2026-09-16.md).

Bagian ini menjadi acuan terkini. Catatan setelah bagian **Arsip progres lama**
dipertahankan sebagai riwayat; persentase, tanggal, commit, dan daftar TODO di
arsip belum tentu menggambarkan workspace sekarang.

| Area | Bukti / status |
|------|----------------|
| Backend API | **64 tes lolos** dalam satu suite pada SQLite sementara, termasuk profil siswa, subbab, dan migrasi terkait |
| Isolasi QA | Database sementara per proses, schema bersih per tes; tidak memakai `.env` development |
| Autentikasi | Regresi retry login, rate limit, refresh rotation/reuse, perubahan password, dan logout lolos |
| CRUD, jadwal, soal, hasil | Tes API dan workflow yang tersedia lolos |
| Mesin ujian | Tes mulai, resume, simpan jawaban, submit, scoring, dan grup tryout lolos |
| Frontend | Pemeriksaan TypeScript dan `npm run build` lolos |
| Refresh token frontend | Sudah diimplementasikan di `frontend/lib/api.ts`; uji browser kedaluwarsa token masih diperlukan |
| Input rumus | Tombol dan dialog MathLive sudah ada; paste Word/MathType dan penggunaan di ponsel belum diverifikasi |
| Lokal | Halaman login, readiness database, dan proxy frontend ke backend mengembalikan HTTP 200 |
| Migrasi | Migrasi constraint lama gagal pada SQLite; PostgreSQL belum diverifikasi |

### Checklist penyelesaian berikutnya

- [x] Audit README terhadap kode saat ini.
- [x] Jalankan suite backend tanpa mengubah database aplikasi lokal.
- [x] Perbarui tes lama sesuai kontrak program, jadwal, review soal, dan proteksi penghapusan.
- [x] Perbaiki bug waktu autentikasi SQLite, invalidasi token logout, dan respons opsi untuk staf.
- [x] Verifikasi TypeScript dan build frontend.
- [ ] Browser end-to-end: mulai → jawab → refresh → offline 2–3 menit → reconnect → submit → hasil.
- [ ] Uji sesi kedaluwarsa di browser, termasuk saat autosave dan gangguan jaringan.
- [ ] Uji responsif, akses keyboard, dan input/paste rumus dengan contoh nyata.
- [ ] Migrasi PostgreSQL dari kosong dan upgrade database versi lama.
- [ ] Uji beban 100+ siswa pada lingkungan yang menyerupai production.
- [ ] UAT admin, guru, siswa, dan konfirmasi branding oleh pemilik proyek.
- [ ] Deployment: server/domain, HTTPS, backup dan uji restore, monitoring, soft launch.

Phase 9 sudah dimulai dan pengujian API otomatis lolos. Phase 8 belum dinyatakan
100% karena QA browser/responsif masih terbuka. Phase 10 belum dinyatakan
selesai tanpa verifikasi deployment. Persentase keseluruhan tidak dihitung dari
jumlah tes yang lolos.

Catatan: logout kini mencabut seluruh sesi akun, termasuk perangkat lain.
Database lokal `backend/dev-local.db` dibuat dari metadata model; ini bukan
bukti bahwa migrasi Alembic berhasil. Detail dan perintah verifikasi ada di
[QA_REPORT.md](QA_REPORT.md).

---

## Arsip progres lama

Track progress pengerjaan sistem CBT dari Fase 0 sampai Fase 10.

---

## 🎯 Project Overview

| Item | Value |
|------|-------|
| Nama Project | Quantum Research CBT System |
| Start Date | 2026-06-25 |
| Target Live Date | 2026-10-25 (4.5 bulan approx) |
| Developer(s) | Rayhan Tama |
| Status | 🟢 Backend complete + Frontend Admin CRUD + Student Pages (exam room/hasil/riwayat) + KaTeX (committed) |

---

## 📅 Phase Status

### ✅ PHASE 0 — Persiapan (Target: 1 minggu)

**Status:** 🟡 In Progress (backend setup siap, branding masih pending)

#### Tasks:
- [ ] Branding & naming finalized
- [x] Repository setup lokal
- [x] Local backend environment usable (Python 3.11 + `.deps`)
- [x] Development database created & connection tested
- [x] Database schema documented
- [x] Role & permissions defined
- [x] Folder structure created
- [x] Documentation completed (.env, DEV_GUIDE, etc)
- [x] Initial Git commit

**Start Date:** 2026-06-25  
**Est End:** 2026-07-02  
**Progress:** 8/9 (89%)  

---

### ✅ PHASE 1 — Backend & Database Setup (Target: 1-2 minggu)

**Status:** ✅ Completed

#### Deliverables (completed):
- FastAPI project structure
- PostgreSQL connection setup
- SQLAlchemy models (13 tabel)
- Alembic migrations (auto-generated + applied)
- Basic endpoints for auth, users, siswa, paket ujian, soal, ujian_siswa, jawaban_siswa, hasil_ujian, log_kecurangan, pelajaran, kelas, program
- Auto-grading on submit and basic integration tests

#### Key Files:
- `app/main.py` — FastAPI app
- `app/models/*.py` — 13 ORM models
- `app/db/database.py` — DB connection
- `alembic/versions/` — Migration scripts (head: d3a7cb98d79d)

**Start Date:** 2026-07-03  
**Completed:** 2026-06-25  
**Progress:** 100%  

---

### ✅ PHASE 2 — Authentication & Otorisasi (Target: 1 minggu)

**Status:** ✅ Completed

#### Deliverables:
- [x] JWT token generation & verification
- [x] Login endpoint (siswa & guru)
- [x] Register endpoint (admin only)
- [x] Password hashing (bcrypt)
- [x] Role-based access control
- [x] Rate limiting (login attempts)
- [x] Logging aktivitas login
- [x] Refresh token
- [x] Change password
- [x] Reset password
- [x] Logout / token invalidation

#### Key Endpoints:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh-token`
- `POST /auth/change-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `POST /auth/logout`

**Start Date:** 2026-07-18  
**Completed:** 2026-07-21  
**Progress:** 100%  

---

### ✅ PHASE 3 — CRUD Master Data (Target: 1-2 minggu)

**Status:** ✅ Completed

#### Deliverables:
- [x] CRUD program (TKA, SNBT, etc)
- [x] CRUD pelajaran
- [x] CRUD siswa
- [x] CRUD soal (detail + opsi, preview metadata HTML/LaTeX, validasi tipe)
- [x] CRUD opsi jawaban
- [x] CRUD paket ujian
- [x] Paket ujian detail + list soal
- [x] Clone paket ujian beserta soal dan opsi
- [x] Upload gambar untuk soal

#### Key Endpoints:
- `/programs/*`
- `/pelajaran/*`
- `/siswa/*`
- `/soal/*` (IMPORTANT!)
- `/paket-ujian/*`

**Start Date:** 2026-07-26  
**Completed:** 2026-07-21  
**Progress:** 100%  

---

### ✅ PHASE 4 — Jadwal Ujian (Target: 3-5 hari)

**Status:** ✅ Completed

#### Deliverables:
- [x] CRUD jadwal ujian
- [x] Validasi waktu jadwal
- [x] Validasi overlap jadwal
- [x] Filter siswa peserta berdasarkan program/kelas
- [x] Soft delete jadwal

#### Key Endpoints:
- `/jadwal-ujian/*`
- `GET /jadwal-ujian/{id}/siswa`

**Start Date:** 2026-08-10  
**Completed:** 2026-07-21  
**Progress:** 100%  

---

### ✅ PHASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (Target: 2-3 minggu)

**Status:** ✅ Completed (backend + frontend exam room). Manual disruption test dipindah ke Phase 9 QA.

**CRITICAL PHASE** — Ini jantung sistem!

#### Deliverables:
- [x] Mulai ujian (generate & save random urutan soal/opsi)
- [x] Fetch soal dengan urutan konsisten
- [x] Timer dari backend
- [x] Autosave jawaban
- [x] Resume ujian (setelah refresh/disconnect)
- [x] Submit ujian (auto-submit saat waktu habis di frontend)
- [x] Log kecurangan dasar (tab blur terintegrasi di exam room)
- [x] Alias endpoint `POST /ujian-siswa/{id}/log-kecurangan`
- [x] Frontend exam room `/siswa/ujian/[id]` (timer, navigasi soal, autosave indicator, submit)
- [ ] (QA) Manual testing refresh/disconnect di browser nyata → Phase 9

#### Key Endpoints:
- `POST /ujian-siswa/mulai`
- `GET /ujian-siswa/{id}/soal/{nomor}`
- `GET /ujian-siswa/{id}/sisa-waktu`
- `POST /ujian-siswa/{id}/jawab`
- `GET /ujian-siswa/{id}/state`
- `POST /ujian-siswa/{id}/submit`
- `POST /ujian-siswa/{id}/log-kecurangan`

**Start Date:** 2026-08-16  
**Completed:** 2026-08-19  
**Progress:** 100%  

**Critical Testing Points:**
- [x] Refresh/restart request → resume normal via saved state
- [ ] Disconnect 2 menit → reconnect lanjut (Phase 9 QA)
- [x] Urutan soal konsisten
- [x] Urutan opsi konsisten
- [x] Timer dari backend
- [x] Autosave jawaban

---

### ✅ PHASE 6 — Scoring & Hasil Ujian (Target: 1 minggu)

**Status:** ✅ Completed

#### Deliverables:
- [x] Auto-calculate skor setelah submit
- [x] Save/update ke hasil_ujian
- [x] Score per pelajaran
- [x] Endpoint siswa lihat hasil ujian mereka
- [x] Endpoint guru/admin lihat semua hasil
- [x] Endpoint manual compute hasil ujian

#### Key Endpoints:
- `GET /hasil-ujian/{id}`
- `GET /hasil-ujian` (list)
- `GET /hasil-ujian/ujian/{ujian_siswa_id}`
- `POST /hasil-ujian/{ujian_siswa_id}/compute`

**Start Date:** 2026-09-07  
**Completed:** 2026-07-21  
**Progress:** 100%  

---

### ✅ PHASE 7 — Dashboard & Monitoring (Target: 1-2 minggu)

**Status:** ✅ Completed

#### Deliverables:
- [x] Dashboard admin/guru statistik dasar
- [x] Monitoring ujian backend
- [x] Log kecurangan dashboard
- [x] Analytics hasil ujian dasar
- [x] Dashboard siswa (jadwal, riwayat, hasil)
- [x] Pengaturan sistem
- [x] Dashboard guru detail hasil siswa

#### Key Endpoints:
- `/dashboard/*`
- `/pengaturan/*`
- `/siswa/dashboard`
- `/siswa/jadwal-ujian`
- `/siswa/riwayat-ujian`
- `/dashboard/hasil-siswa`

**Start Date:** 2026-09-14  
**Completed:** 2026-07-22  
**Progress:** 100%  

---

### 🟡 PHASE 8 — Frontend Lengkap (Target: 3-4 minggu)

**Status:** 🟡 In Progress (~90%)

#### Deliverables:
- [x] Next.js (App Router) + TypeScript + Tailwind setup
- [x] Auth pages (login, logout) + role redirect
- [x] Admin/Guru panel (CRUD program, pelajaran, kelas, siswa, paket, soal, jadwal, users)
- [x] Rich text editor (RichEditor custom, paste MathType)
- [x] Dashboard admin & dashboard siswa
- [x] Siswa panel: **ujian room** (`/siswa/ujian/[id]`) — timer backend, navigasi, autosave, submit
- [x] `/siswa/ujian-aktif` & `/siswa/riwayat` & `/siswa/hasil/[id]`
- [x] KaTeX renderer (`MathContent` — render LaTeX `$…$`, `$$…$$`, `\(…\)`, `\[…\]`)
- [x] Timer component (dari backend, poll 10s) & autosave indicator
- [x] Protected route / role guard global (`RoleGuard` di admin & siswa layout)
- [ ] Refresh-token auto-handling saat 401 (opsional)
- [ ] Input rumus UX (tombol sisipkan / paste MathType→LaTeX) — belum tuntas
- [ ] Responsive design polish

**Start Date:** 2026-08-12 (paralel dengan Phase 3-7)  
**Est End:** —  
**Progress:** ~90% (committed: b9e2fdd)  

---

### 🔴 PHASE 9 — Testing & QA (Target: 2 minggu)

**Status:** 🔴 Not started

#### Deliverables:
- Unit tests (backend)
- Integration tests (flow ujian lengkap)
- Load tests (100+ siswa bersamaan)
- Manual testing (skenario gangguan)
- UAT dengan user asli
- Bug fixes

**Start Date:** 2026-10-28  
**Est End:** 2026-11-10  
**Progress:** 0%  

---

### 🔴 PHASE 10 — Deployment & Go-Live (Target: 3-5 hari)

**Status:** 🔴 Not started

#### Deliverables:
- VPS setup + Docker
- Database production
- HTTPS SSL setup
- Backup automation
- Briefing user
- Soft launch + monitoring

**Start Date:** 2026-11-11  
**Est End:** 2026-11-18  
**Progress:** 0%  

---

## 📈 Overall Progress

```
Phase 0  █████████░ 89%  (backend + git commit ready, branding pending)
Phase 1  ██████████ 100%
Phase 2  ██████████ 100%
Phase 3  ██████████ 100%
Phase 4  ██████████ 100%
Phase 5  ██████████ 100%  ⭐ Core engine + exam room frontend
Phase 6  ██████████ 100%
Phase 7  ██████████ 100%  ⭐ + Grouping Tryout
Phase 8  █████████░ 90%   ⭐ Admin CRUD + Student pages + KaTeX + RoleGuard
Phase 9  ░░░░░░░░░░ 0%
Phase 10 ░░░░░░░░░░ 0%

Total backend MVP: 100% (Phase 1-7 complete + Grouping feature)
Total frontend: ~90% (Admin CRUD + Auth + Student pages incl. exam room + KaTeX + RoleGuard)
Total project end-to-end: ~88%
```

> **Update 2026-08-19:** Student pages + KaTeX **sudah di-commit** (commit `b9e2fdd`):
> exam room `/siswa/ujian/[id]` (timer backend, autosave, resume, submit, anti-cheat log), `/siswa/ujian-aktif`, `/siswa/riwayat`, `/siswa/hasil/[id]`, `RoleGuard` global (admin & siswa), dan integrasi KaTeX (`MathContent` + `lib/sanitize`). Working tree bersih, branch `main` ahead dari origin (belum push). Yang masih terbuka: input-rumus UX (tombol sisip/paste MathType→LaTeX), refresh-token auto-handling, lalu Phase 9 Testing & QA. Lihat **`AI_HANDOFF.md` (root)** untuk detail terbaru.

---

## 🐛 Known Issues & Notes

### Phase 8 (Frontend) — Key Points (update 2026-08-19):
- **DONE:** Auth flow di `frontend/lib/auth.ts` (login/logout/getUser/isAuthenticated) + role redirect
- **DONE:** Login page `/login` memakai design system & redirect by role
- **DONE:** Header role-aware (menu admin/guru vs siswa, username, logout)
- **DONE:** CRUD Kelas (`/admin/kelas`) & CRUD Users (`/admin/users`)
- **DONE:** RichEditor custom (`frontend/components/RichEditor.tsx`) + manajemen Opsi Jawaban di halaman Soal
- **DONE:** CORS di backend + `GET /dashboard/admin` + `GET /users/` (admin only)
- **DONE:** Dashboard Siswa di-upgrade (stat cards klik, auth guard)
- **DONE (2026-08-19, commit b9e2fdd):** Exam room `/siswa/ujian/[id]` (timer backend, autosave, resume, submit, log kecurangan)
- **DONE:** `/siswa/ujian-aktif`, `/siswa/riwayat`, `/siswa/hasil/[id]`
- **DONE:** `RoleGuard` global membungkus layout admin & siswa
- **DONE:** KaTeX via `MathContent` (soal & opsi di exam room, admin soal, preview RichEditor); `sanitizeHtml` dipindah ke `frontend/lib/sanitize.ts`
- **TODO:** Input-rumus UX (paste MathType/Word sering pecah antar tag; perlu tombol sisip rumus / normalisasi paste)
- **TODO:** Refresh-token auto-handling saat 401 (opsional)
- **TODO:** Responsive polish

### Environment / Repo Notes:
- [x] Python 3.11 tersedia dan test bisa dijalankan dengan `PYTHONPATH=.deps`
- [x] Backend test suite terakhir: 24 passed
- [x] Frontend `npm run build` sukses (19 route) setelah integrasi KaTeX
- [x] Git working tree bersih; student pages + KaTeX sudah di-commit (`b9e2fdd`)
- [ ] Branch `main` ahead dari `origin/main` — belum di-push
- [ ] Production PostgreSQL belum disiapkan; development masih memakai konfigurasi lokal

### Phase 7 (Ujian Engine) — Key Points:
- **DONE:** Random urutan disimpan ke DB (`soal_urutan`, `opsi_urutan`)
- **DONE:** Timer dihitung dari backend
- **DONE:** Autosave jawaban tersedia
- **DONE:** Alias log kecurangan tersedia di `/ujian-siswa/{id}/log-kecurangan`
- **DONE:** Grouping tryout implemented with overlap validation per group
- **TODO:** Manual test skenario browser refresh/disconnect/offline 2-3 menit

### Grouping Tryout (2026-08-12):
- **DONE:** GrupTryout model with unique name validation
- **DONE:** Migration 9d0e1f2a3b45_add_grup_tryout.py
- **DONE:** CRUD router /grup-tryout/ with admin-only access
- **DONE:** Non-overlap validation per group on jadwal create/update
- **DONE:** Start ujian validation with grup_tryout_id
- **DONE:** Frontend pages: /admin/jadwal-ujian and /siswa/jadwal-ujian
- **DONE:** Comprehensive tests (13/13 manual, 4/5 pytest)
- **DONE:** Documentation: PANDUAN_GRUP_TRYOUT.md

---

## 📝 Completed Deliverables

### Phase 0:
- [x] README.md — Project overview
- [x] ROADMAP.md — Lengkap fase 0-10
- [x] PHASE_0_CHECKLIST.md — Action items konkret
- [x] DATABASE.md — Spesifikasi tabel & schema
- [x] ARCHITECTURE.md — Design & flow sistem
- [x] PROGRESS_TRACKER.md — File ini

### Phase 1+:
- [x] Backend project structure
- [x] Models utama + GrupTryout model
- [x] Alembic migrations (latest: 9d0e1f2a3b45_add_grup_tryout)
- [x] Auth & role-based access
- [x] CRUD master data + grup tryout
- [x] Jadwal ujian with grouping & overlap validation per group
- [x] Mesin ujian core with grup validation
- [x] Scoring & hasil ujian
- [x] Dashboard/pengaturan backend
- [x] Frontend Phase 3: Master data CRUD (Program, Pelajaran, Siswa, Paket, Soal)
- [x] Frontend: Quantum Research design system
- [x] Frontend: Reusable components (Button, Card, Table, Input, etc)
- [x] Frontend: Admin dashboard + navigation
- [x] Frontend: Student-facing pages (exam room, ujian-aktif, riwayat, hasil)
- [x] Frontend: KaTeX math rendering + global RoleGuard
- [ ] Seed data production-ready
- [ ] End-to-end testing

---

## 🎯 Next Immediate Actions (Priority Order)

### NEXT:
1. **✅ Grouping Tryout (COMPLETED 2026-08-12):**
   - [x] GrupTryout model & migration
   - [x] CRUD router with validation
   - [x] Overlap validation per group
   - [x] Start ujian with grup validation
   - [x] Frontend pages for admin & siswa
   - [x] Tests & documentation

2. **✅ Phase 3 Frontend CRUD (COMPLETED 2026-08-12):**
   - [x] Quantum Research design system
   - [x] Tailwind config with custom palette
   - [x] Reusable components (7 components)
   - [x] Admin layout with header & navigation
   - [x] Dashboard with statistics
   - [x] Program CRUD page
   - [x] Pelajaran CRUD page
   - [x] Siswa CRUD page
   - [x] Paket Ujian CRUD page
   - [x] Soal CRUD page

3. **✅ Frontend Auth/CRUD lanjutan (COMMITTED 2026-08-18, commit 9841900):**
   - [x] Login flow + redirect role + logout (auth.ts, /login, Header)
   - [x] RichEditor custom + CRUD Opsi Jawaban (halaman Soal)
   - [x] CRUD Kelas & CRUD Users
   - [x] CORS + GET /dashboard/admin + GET /users/ (backend)
   - [x] Dashboard Siswa di-upgrade

4. **✅ Student Pages + KaTeX (COMMITTED 2026-08-19, commit b9e2fdd):**
   - [x] Exam room `/siswa/ujian/[id]` (timer backend, autosave, resume, submit, log kecurangan)
   - [x] `/siswa/ujian-aktif`, `/siswa/riwayat`, `/siswa/hasil/[id]`
   - [x] `RoleGuard` global (admin & siswa layout)
   - [x] KaTeX (`MathContent`) + refactor `sanitizeHtml` ke `lib/sanitize.ts`

5. **Next: Phase 9 Testing & QA + polish:**
   - [ ] Integration testing student flow (mulai → jawab → refresh/resume → submit → hasil)
   - [ ] Manual disruption test (refresh/disconnect 2-3 menit)
   - [ ] Input-rumus UX (paste MathType/Word → LaTeX, tombol sisip rumus)
   - [ ] Refresh-token auto-handling saat 401 (opsional)

> **Catatan:** Fondasi Phase 8 (student pages + exam room + KaTeX + RoleGuard) sudah selesai & di-commit. Fokus berikut: Phase 9 Testing & QA. Lihat `AI_HANDOFF.md` di root untuk panduan AI berikutnya yang paling lengkap.

---

## 📊 Metrics & KPIs

Track ini akan di-update weekly:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Documentation Complete | 100% | 99% | 🟢 Excellent |
| Backend Phases 1-7 | Stable MVP | 100% | ✅ Complete + Grouping |
| Backend Test Suite | Passing | 24 passed | ✅ |
| Frontend CRUD Pages | Phase 3 | 100% | ✅ Complete + Kelas/Users |
| Frontend Auth Flow | Phase 8 | 95% | 🟢 Login/redirect/logout + RoleGuard global; refresh-token opsional |
| Frontend Student Pages | Phase 8 | 90% | 🟢 Exam room + ujian-aktif + riwayat + hasil done |
| KaTeX Math Rendering | Phase 8 | 90% | 🟢 Render done; input-rumus UX pending |
| UAT Completed | Phase 9 | 0% | 🔴 Not started |
| Go-Live | Phase 10 | 0% | 🔴 Not started |
| Bug-free Rate | > 95% | Pending QA | 🟡 |

---

## 📅 Weekly Review Template

**Week #XX (Date range):**

```
Phase Being Worked On: Phase Y
Completion: X%

Accomplished This Week:
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

Blockers / Issues:
- [ ] Issue 1: ...
- [ ] Issue 2: ...

Next Week Goals:
- [ ] Goal 1
- [ ] Goal 2

Notes:
- ...
```

---

## 📞 Contact & Support

**Project Lead:** Rayhan Tama  
**Organization:** Quantum Research (Bimbel)  
**Repository:** [TBD — setup saat Phase 1]  
**Documentation:** This folder (`docs/`)  

---

**Last Updated:** 2026-08-19  
**Next Update:** After Phase 9 Testing & QA kickoff  
**Status:** ✅ Backend complete + Frontend Admin CRUD + Student pages (exam room/hasil/riwayat) + KaTeX + RoleGuard committed (b9e2fdd), focus next: Phase 9 Testing & QA
