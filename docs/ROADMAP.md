# 🗺️ Roadmap Lengkap CBT Quantum Research

## Acuan client terbaru — 18 September 2026

Aturan dan implementasi terbaru ada di [catatan 18 September](CLIENT_REQUESTS_2026-09-18.md).
Drilling sudah aktif, UTBK dapat kembali ke mapel sebelumnya, paket menggunakan
penugasan guru eksplisit, dan revisi approved mengganti soal pada paket belum mulai.

### Catatan sebelumnya — 17 September

Lihat [kebutuhan dan status implementasi terbaru](CLIENT_REQUESTS_2026-09-17.md).
Persetujuan soal hanya admin; spesifikasi IRT/drill belum tersedia. Checklist
historis di bawah belum mencerminkan seluruh perubahan client terbaru.

## Progres UI dan prioritas — 19 September 2026

UI siswa telah diperbarui mengikuti arah referensi client: tema gelap, banner
gradasi, kartu Tryout, menu ikon dengan background navy polos, dan navigasi bawah
mengambang. Topbar memakai logo Quantum dan tulisan **QUANTUM**.

Status: Phase 8 menunggu QA visual/responsif; Phase 9 sedang berjalan; Phase 10
belum selesai. Prioritas berikutnya adalah uji browser alur ujian/latihan,
UAT client, perluasan filter/paginasi daftar master, validasi PostgreSQL, uji
beban, lalu deployment. Penilaian biasa digunakan; skor kohort/IRT ditunda.

Checklist terkini: [PROGRESS_TRACKER.md](PROGRESS_TRACKER.md).
Checklist fase, estimasi durasi, dan status footer di bawah merupakan rencana
historis; bukan laporan penyelesaian terbaru.

## Ringkasan Eksekutif

Sistem CBT (Computer Based Test) berbasis web untuk Bimbel **Quantum Research**, digunakan untuk ujian dan latihan soal online (TKA, SNBT, Speedtest, Ujian Mandiri) sementara kegiatan belajar tetap dilakukan offline.

**Prinsip utama:** Backend stabil dulu, frontend sederhana tapi mudah dipakai siswa & guru.

**Tech Stack:**
- **Backend:** FastAPI + PostgreSQL + SQLAlchemy + Alembic
- **Frontend:** React / Next.js
- **Auth:** JWT (access + refresh token)
- **Deployment:** VPS/Cloud (Docker)

---

## 📅 FASE 0 — Persiapan (1 minggu)

**Tujuan:** Pondasi project sebelum mulai coding.

### Checklist:
- [ ] Finalisasi branding: logo simple, warna utama, domain
- [ ] Setup repository Git (backend & frontend repo terpisah)
- [ ] Setup environment lokal:
  - [ ] Python 3.10+ & venv
  - [ ] PostgreSQL
  - [ ] Node.js (untuk frontend nanti)
  - [ ] Git
- [ ] Buat ERD (Entity Relationship Diagram) dari 13 tabel
- [ ] Tentukan role akun: `admin`, `guru`, `siswa`
- [ ] Finalisasi spesifikasi database

### Output Fase 0:
✅ ERD siap  
✅ Repo siap  
✅ Environment siap  
✅ Dokumentasi architecture siap  

---

## 📅 FASE 1 — Setup Backend & Database (1–2 minggu)

**Tujuan:** Backend bisa berjalan, database siap, struktur clean.

### Subtasks:
1. **Init FastAPI project**
   - Struktur folder: `app/models`, `app/schemas`, `app/routers`, `app/services`, `app/core`
   - Setup main.py, config.py
   - Setup dependency injection basic

2. **Setup PostgreSQL via SQLAlchemy**
   - Connection pooling
   - URL database config dari env variable

3. **Setup Alembic untuk migration**
   - First migration template ready

4. **Buat 13 model utama:**
   - `users` (id, username, password_hash, role, created_at)
   - `siswa` (id, user_id, nama_lengkap, no_induk, program_id)
   - `program` (id, nama, deskripsi) — TKA, SNBT, Speedtest, Ujian Mandiri
   - `pelajaran` (id, nama, program_id)
   - `paket_ujian` (id, nama, deskripsi, program_id, durasi_menit, jumlah_soal)
   - `soal` (id, paket_ujian_id, pelajaran_id, teks_soal, tipe, urutan)
   - `opsi_jawaban` (id, soal_id, teks_opsi, is_benar, urutan)
   - `jadwal_ujian` (id, paket_ujian_id, waktu_mulai, waktu_selesai)
   - `ujian_siswa` (id, siswa_id, jadwal_ujian_id, waktu_mulai, waktu_selesai, status)
   - `jawaban_siswa` (id, ujian_siswa_id, soal_id, opsi_jawaban_id, diacak_urutan_soal_json)
   - `hasil_ujian` (id, ujian_siswa_id, skor, skor_per_pelajaran_json)
   - `log_kecurangan` (id, ujian_siswa_id, tipe_kecurangan, deskripsi, created_at)
   - `pengaturan` (id, kunci, nilai_json)

5. **Tabel tambahan (belum di resume tapi penting):**
   - `kelas` — untuk Kelas 12 vs SMP
   - `sesi_login` — untuk tracking device/IP siswa, antisipasi joki ujian

6. **Jalankan migration pertama, seed data dummy:**
   - 1 admin user
   - Program (TKA, SNBT, Speedtest, Ujian Mandiri)
   - Beberapa pelajaran dummy

### Output Fase 1:
✅ Database running, tabel lengkap  
✅ Bisa migrate up/down  
✅ Seed data ready  
✅ Backend struktur clean  

---

## 📅 FASE 2 — Authentication & Otorisasi (1 minggu)

**Tujuan:** Sistem login, JWT, role-based access control.

### Subtasks:
1. **Password hashing** — gunakan bcrypt
2. **JWT generator** — access token (15 min) + refresh token (7 hari)
3. **Endpoint register** — khusus admin yang bisa daftarkan siswa/guru, bukan self-register
4. **Endpoint login** — return access + refresh token
5. **Middleware/dependency** — cek role (admin/guru vs siswa)
6. **Endpoint ganti password**
7. **Endpoint reset password** (oleh admin)
8. **Rate limiting sederhana** — login max 5x dalam 5 menit per IP
9. **Logging aktivitas login** — simpan ke database untuk monitoring

### Endpoints:
```
POST   /auth/login              — login siswa/guru
POST   /auth/refresh-token      — refresh access token
POST   /auth/register           — admin daftar siswa/guru
POST   /auth/change-password    — ganti password user sendiri
POST   /auth/reset-password     — admin reset password user
GET    /auth/me                 — get current user info
POST   /auth/logout             — invalidate token (opsional)
```

### Output Fase 2:
✅ Siswa & guru bisa login  
✅ Sistem role berjalan  
✅ Token aman & tervalidasi  

---

## 📅 FASE 3 — CRUD Master Data (1–2 minggu)

**Tujuan:** Guru/admin bisa kelola program, pelajaran, soal, paket ujian.

### Subtasks:

#### 3.1 CRUD Program
```
GET    /programs               — list program
POST   /programs               — create program (admin only)
GET    /programs/{id}          — detail program
PUT    /programs/{id}          — update program
DELETE /programs/{id}          — delete program
```

#### 3.2 CRUD Pelajaran
```
GET    /pelajaran              — list pelajaran
POST   /pelajaran              — create pelajaran (admin)
GET    /pelajaran/{id}         — detail pelajaran
PUT    /pelajaran/{id}         — update pelajaran
DELETE /pelajaran/{id}         — delete pelajaran
```

#### 3.3 CRUD Siswa
```
GET    /siswa                  — list siswa (guru/admin)
POST   /siswa                  — daftar siswa baru
GET    /siswa/{id}             — detail siswa
PUT    /siswa/{id}             — update profil siswa
DELETE /siswa/{id}             — soft delete siswa
```

#### 3.4 CRUD Soal (PENTING!)
- **Support rich text editor** → simpan HTML
- **Support rumus matematika** → simpan LaTeX/MathML, render dengan KaTeX di frontend
- **Upload gambar** → store di cloud/server, return URL
- **Validate:** urutan soal unik per paket, tipe soal valid

```
GET    /soal                   — list soal (filter by paket_ujian)
POST   /soal                   — create soal (guru/admin)
GET    /soal/{id}              — detail soal + opsi jawaban
PUT    /soal/{id}              — update soal
DELETE /soal/{id}              — delete soal
GET    /soal/{id}/preview      — preview soal dengan render rumus
```

#### 3.5 CRUD Opsi Jawaban
```
GET    /soal/{soal_id}/opsi    — list opsi jawaban per soal
POST   /soal/{soal_id}/opsi    — create opsi jawaban
PUT    /opsi/{opsi_id}         — update opsi
DELETE /opsi/{opsi_id}         — delete opsi
```

#### 3.6 CRUD Paket Ujian
```
GET    /paket-ujian            — list paket ujian (filter by program)
POST   /paket-ujian            — create paket ujian (guru/admin)
GET    /paket-ujian/{id}       — detail paket ujian + list soal
PUT    /paket-ujian/{id}       — update paket ujian
DELETE /paket-ujian/{id}       — delete paket ujian
POST   /paket-ujian/{id}/clone — clone paket ujian (copy soal)
```

### Output Fase 3:
✅ Guru/admin bisa input & kelola soal  
✅ Paket ujian lengkap dengan soal  
✅ Validation & error handling solid  

---

## 📅 FASE 4 — Jadwal Ujian (3–5 hari)

**Tujuan:** Admin bisa atur kapan ujian berlangsung, untuk siapa.

### Subtasks:
1. **CRUD jadwal_ujian**
2. **Validasi:** waktu mulai < waktu selesai, tidak overlap dengan jadwal lain
3. **Filter siswa** mana saja yang berhak ikut jadwal tertentu (berdasarkan program/kelas)
4. **Soft delete** jadwal (jangan hard delete, untuk audit trail)

### Endpoints:
```
GET    /jadwal-ujian           — list jadwal ujian (filter by program/status)
POST   /jadwal-ujian           — create jadwal ujian (admin)
GET    /jadwal-ujian/{id}      — detail jadwal + peserta ujian
PUT    /jadwal-ujian/{id}      — update jadwal ujian
DELETE /jadwal-ujian/{id}      — soft delete jadwal ujian
GET    /jadwal-ujian/{id}/siswa — list siswa peserta jadwal ini
```

### Output Fase 4:
✅ Admin bisa atur jadwal ujian  
✅ Siswa tahu jadwal ujian mereka  

---

## 📅 FASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (2–3 minggu)

**⚠️ INI YANG PALING KRITIS DAN RUMIT. HARUS MATANG SEBELUM LANJUT KE FASE LAIN.**

### Prinsip Utama:
1. **Random soal & jawaban per siswa** — harus konsisten saat refresh
2. **Timer dari backend** — bukan dari client
3. **Autosave otomatis** — setiap N detik
4. **Resume ujian** — siswa bisa lanjut setelah refresh/disconnect
5. **Anti-manipulation** — hindari cheating

### Subtasks:

#### 5.1 Mulai Ujian
```
POST   /ujian-siswa/mulai
Request:
{
  "jadwal_ujian_id": 1
}

Response:
{
  "ujian_siswa_id": 123,
  "jadwal_ujian_id": 1,
  "soal_urutan": [45, 12, 89, 34, ...],      // urutan soal yang sudah diacak
  "waktu_mulai": "2026-06-25T10:00:00Z",
  "waktu_selesai": "2026-06-25T11:00:00Z",
  "durasi_menit": 60,
  "jumlah_soal": 50,
  "sisa_waktu_detik": 3600
}
```

**Di backend:**
- Generate `soal_urutan` secara random
- Simpan urutan ini ke `jawaban_siswa.diacak_urutan_soal_json` atau tabel relasi
- **JANGAN REGENERATE** urutan saat refresh — ambil dari DB

#### 5.2 Fetch Soal (dengan opsi yang sudah diacak)
```
GET    /ujian-siswa/{ujian_siswa_id}/soal/{nomor_urut}
       
Response:
{
  "soal_id": 45,
  "teks_soal": "Berapa hasil 2+2?",
  "tipe": "pilihan_ganda",
  "opsi_urutan": [2, 4, 1, 3],  // urutan opsi yang sudah diacak
  "opsi": [
    { "opsi_id": 1, "teks": "3", "posisi": 2 },
    { "opsi_id": 2, "teks": "4", "posisi": 0 },  // posisi 0 = urutan pertama
    { "opsi_id": 3, "teks": "5", "posisi": 3 },
    { "opsi_id": 4, "teks": "6", "posisi": 1 }
  ],
  "jawaban_user": 2  // opsi_id yang dipilih user (jika sudah dijawab)
}
```

**Di backend:**
- Fetch soal dari urutan yang tersimpan
- Random opsi jawaban jika belum ada urutan yang tersimpan
- Simpan urutan opsi untuk konsistensi

#### 5.3 Timer dari Backend
```
GET    /ujian-siswa/{ujian_siswa_id}/sisa-waktu

Response:
{
  "sisa_waktu_detik": 1234,
  "server_time": "2026-06-25T10:20:34Z"
}
```

**Di backend:**
```python
sisa_waktu = durasi_menit - (sekarang - waktu_mulai)
if sisa_waktu < 0:
    sisa_waktu = 0  # ujian sudah selesai
```

**Di frontend:**
- Jangan hitung timer sendiri (rentan manipulasi)
- Setiap 5-10 detik call endpoint ini
- Update UI dengan nilai yang dikembalikan backend

#### 5.4 Autosave Jawaban
```
POST   /ujian-siswa/{ujian_siswa_id}/jawab

Request:
{
  "soal_id": 45,
  "opsi_jawaban_id": 2  // pilihan siswa
}

Response:
{
  "status": "saved",
  "timestamp": "2026-06-25T10:20:34Z"
}
```

**Di backend:**
- Upsert ke `jawaban_siswa` table
- Validasi: ujian masih berlangsung, soal valid, opsi valid
- Catat timestamp
- **Idempotent:** memanggil endpoint ini berkali-kali dengan data sama tidak merusak

#### 5.5 Resume Ujian (Setelah Refresh/Disconnect)
```
GET    /ujian-siswa/{ujian_siswa_id}/state

Response:
{
  "ujian_siswa_id": 123,
  "status": "sedang",  // "belum_mulai" / "sedang" / "selesai" / "timeout"
  "soal_urutan": [45, 12, 89, 34, ...],
  "opsi_urutan": {
    "45": [2, 4, 1, 3],  // per soal, urutan opsi yang sudah diacak
    "12": [3, 1, 4, 2],
    ...
  },
  "jawaban_tersimpan": {
    "45": 2,  // soal_id → opsi_jawaban_id yang dipilih
    "12": null,  // belum dijawab
    ...
  },
  "waktu_mulai": "2026-06-25T10:00:00Z",
  "waktu_selesai": "2026-06-25T11:00:00Z",
  "sisa_waktu_detik": 1234
}
```

**Di backend:**
- Ambil data ujian dari DB
- Hitung sisa waktu
- Return urutan soal & opsi yang tersimpan
- Return jawaban yang sudah disimpan
- **Idempotent & aman** — client bisa call ini berkali-kali saat reconnect

#### 5.6 Submit / Selesai Ujian
```
POST   /ujian-siswa/{ujian_siswa_id}/submit

Response:
{
  "status": "submitted",
  "waktu_submit": "2026-06-25T10:59:45Z"
}
```

**Di backend:**
- Validasi ujian masih berlangsung (atau sudah timeout)
- Auto-submit jika waktu sudah habis
- Mark ujian_siswa status = "selesai"
- Jangan auto-calculate skor di sini (harus di Fase 6)

#### 5.7 Anti-Kecurangan Dasar
```
POST   /ujian-siswa/{ujian_siswa_id}/log-kecurangan

Request:
{
  "tipe": "tab_blur" | "tab_focus" | "fullscreen_exit" | "copy_attempt"
}

Response:
{
  "logged": true
}
```

**Di backend:**
- Log ke tabel `log_kecurangan`
- Jangan auto-kick user (biarkan guru yang putuskan nanti)

### Output Fase 5:
✅ Siswa bisa ujian dari mulai sampai submit  
✅ Tahan refresh & disconnect  
✅ Random konsisten, timer akurat  
✅ Autosave berfungsi  

---

## 📅 FASE 6 — Scoring & Hasil Ujian (1 minggu)

**Tujuan:** Skor otomatis dihitung setelah ujian selesai.

### Subtasks:
1. **Hitung skor otomatis** (untuk pilihan ganda: benar/salah)
2. **Simpan ke hasil_ujian**
3. **Score per pelajaran** (jika ada breakdown)
4. **Endpoint siswa lihat hasil**
5. **Endpoint guru/admin lihat rekap**

### Endpoints:
```
GET    /hasil-ujian/{ujian_siswa_id}         — siswa lihat hasil ujian mereka
GET    /hasil-ujian                          — guru/admin lihat semua hasil
POST   /hasil-ujian/{ujian_siswa_id}/compute — manual trigger compute (opsional)
```

### Scoring Logic:
```python
skor = (jumlah_benar / jumlah_soal) * 100
```

### Output Fase 6:
✅ Skor otomatis setelah ujian selesai  
✅ Siswa & guru bisa lihat hasil  

---

## 📅 FASE 7 — Dashboard & Monitoring (1–2 minggu)

**Tujuan:** Admin/guru punya visibilitas, siswa punya halaman pribadi.

### Dashboard Admin/Guru:
```
GET    /dashboard/statistik
       → jumlah siswa aktif, ujian berjalan, rata-rata nilai, dsb

GET    /dashboard/monitoring-ujian
       → list siswa yang sedang ujian, status, sisa waktu

GET    /dashboard/log-kecurangan
       → list kecurangan per siswa/ujian

GET    /dashboard/hasil-analytics
       → grafik nilai, distribusi skor, per program/pelajaran
```

### Dashboard Siswa:
```
GET    /siswa/dashboard
       → jadwal ujian mendatang, riwayat ujian, hasil terakhir

GET    /siswa/jadwal-ujian
       → list jadwal ujian siswa itu

GET    /siswa/riwayat-ujian
       → list ujian yang sudah dikerjakan + hasil
```

### Pengaturan Sistem:
```
GET    /pengaturan           — fetch semua setting
PUT    /pengaturan/{kunci}   — update setting tertentu
```

Contoh pengaturan:
- Nama institusi: "Quantum Research"
- Logo URL
- Kontak
- Kebijakan menampilkan hasil (langsung / ditahan guru)

### Output Fase 7:
✅ Admin/guru punya monitoring real-time  
✅ Siswa punya dashboard pribadi  

---

## 📅 FASE 8 — Frontend Lengkap (Paralel dengan Fase 3-7, atau setelahnya) (3–4 minggu)

**Catatan:** Bisa dibangun paralel atau setelah API utama siap.

### Struktur:
```
frontend/
├── pages/
│   ├── login.jsx               — halaman login siswa & guru
│   ├── admin/
│   │   ├── dashboard.jsx       — dashboard admin
│   │   ├── program/index.jsx   — CRUD program
│   │   ├── soal/index.jsx      — CRUD soal (dengan editor)
│   │   ├── paket-ujian/        — CRUD paket ujian
│   │   ├── jadwal-ujian/       — CRUD jadwal ujian
│   │   └── monitoring/         — monitoring ujian live
│   ├── guru/
│   │   ├── dashboard.jsx       — dashboard guru (simplified)
│   │   ├── hasil-ujian/        — lihat hasil siswa
│   │   └── log-kecurangan/     — lihat log kecurangan
│   ├── siswa/
│   │   ├── dashboard.jsx       — dashboard siswa
│   │   ├── jadwal-ujian.jsx    — list jadwal ujian
│   │   ├── ujian/
│   │   │   ├── [ujian_id].jsx  — halaman ujian (timer, soal, autosave)
│   │   │   └── hasil.jsx       — lihat hasil ujian
│   │   └── riwayat-ujian.jsx   — riwayat ujian
│   └── 404.jsx                 — not found
├── components/
│   ├── ExamTimer.jsx           — komponen timer
│   ├── SoalRenderer.jsx         — render soal + rumus matematika
│   ├── RichTextEditor.jsx       — editor soal (TipTap/Quill)
│   ├── AnswerRadio.jsx          — pilihan jawaban
│   ├── Navbar.jsx              — top navigation
│   └── ...
├── lib/
│   ├── api.js                  — axios instance + API calls
│   ├── auth.js                 — auth helpers (JWT, localStorage)
│   └── math.js                 — KaTeX render helper
├── styles/
│   ├── globals.css             — Tailwind
│   └── ...
└── package.json
```

### Prioritas Komponen:

#### 8.1 Setup & Auth (1 minggu)
- [ ] Halaman login (siswa & guru)
- [ ] Halaman register (admin daftarkan user)
- [ ] JWT handling (store, refresh, logout)
- [ ] Protected routes / role-based navigation

#### 8.2 Panel Admin/Guru (2 minggu)
- [ ] Dashboard overview
- [ ] CRUD program
- [ ] CRUD pelajaran
- [ ] **Rich text editor + KaTeX untuk soal** ← penting!
- [ ] CRUD paket ujian
- [ ] CRUD jadwal ujian
- [ ] Monitoring ujian real-time

#### 8.3 Panel Siswa (1.5 minggu)
- [ ] Dashboard siswa
- [ ] List jadwal ujian
- [ ] Halaman ujian (PENTING!):
  - [ ] Timer countdown (ambil dari backend)
  - [ ] Navigasi soal (prev/next, jump to question)
  - [ ] Render soal + rumus matematika dengan KaTeX
  - [ ] Radio button untuk pilihan jawaban
  - [ ] Autosave indicator ("Tersimpan ✓" atau spinner)
  - [ ] Penanganan disconnect → auto-reconnect
- [ ] Halaman hasil ujian

#### 8.4 Responsive & Polish (0.5-1 minggu)
- [ ] Mobile-friendly (tested di tablet)
- [ ] Error handling yang user-friendly
- [ ] Loading states
- [ ] Accessibility basics

### Tech Stack Frontend:
- **Framework:** Next.js (SSR/SSG, file-based routing mudah)
- **Styling:** Tailwind CSS
- **HTTP:** Axios
- **State management:** React Context API (cukup sederhana) atau Zustand
- **Rich text:** TipTap (modern, headless)
- **Math rendering:** KaTeX (cepat, lightweight)
- **Date picker:** react-datepicker atau date-fns
- **UI components:** Shadcn/ui atau Headless UI

### Output Fase 8:
✅ Aplikasi web complete end-to-end  
✅ Siap dipakai user  

---

## 📅 FASE 9 — Testing & QA (2 minggu)

**Tujuan:** Sistem teruji, siap go-live.

### Unit Testing (Backend):
```python
# test_auth.py — logic login, JWT, hash password
# test_soal.py — random soal, validation
# test_scoring.py — kalkulasi skor
# test_timer.py — kalkulasi sisa waktu
```

Gunakan: `pytest` + `pytest-cov`

### Integration Testing:
- Flow ujian penuh: login → lihat jadwal → mulai ujian → autosave → refresh → resume → submit
- Random urutan konsisten saat refresh
- Timer akurat
- Scoring benar

Gunakan: `pytest` + `httpx` (async HTTP client)

### Load Testing:
Simulasikan banyak siswa ujian bersamaan (critical untuk ujian serentak per kelas).

Gunakan: `Locust` atau `Apache JMeter`

Skenario:
- 100 siswa login bersamaan
- 50 siswa ujian bersamaan (30 menit)
- Check server response time, CPU, memory

### Manual Testing — Skenario Gangguan:
- [ ] Refresh di tengah ujian → lanjut normal ✓
- [ ] Tutup browser, buka kembali → lanjut normal ✓
- [ ] Putus internet 1-2 menit → reconnect otomatis ✓
- [ ] Waktu habis saat siswa masih mengerjakan → auto-submit ✓
- [ ] 2 device login dengan akun sama → antisipasi joki ✓
- [ ] Copy jawaban tidak bekerja di halaman ujian (protect copy/paste)
- [ ] F12 console tidak bisa modify timer
- [ ] Logout → tidak bisa akses ujian lagi

### User Acceptance Test (UAT):
- Pilot test dengan 10-20 siswa & 3-5 guru asli di Quantum Research
- Catat feedback, bug, usability issue
- Perbaiki bug critical
- Dokumentasikan workaround untuk bug minor

### Output Fase 9:
✅ Sistem teruji & stabil  
✅ Siap dipakai ujian sebenarnya  

---

## 📅 FASE 10 — Deployment & Go-Live (3–5 hari)

**Tujuan:** Sistem hidup di production.

### Checklist:

#### 10.1 Infrastruktur
- [ ] Sewa VPS (AWS, Digital Ocean, Linode, atau lokal di Quantum Research)
- [ ] Install Docker & Docker Compose
- [ ] Setup database PostgreSQL production (backup otomatis harian)
- [ ] Setup volume storage untuk backup

#### 10.2 Backend Deployment
- [ ] Build Docker image FastAPI
- [ ] Push ke registry (Docker Hub / private registry)
- [ ] Setup environment variables production
- [ ] Deploy dengan docker-compose atau Kubernetes
- [ ] Setup reverse proxy (Nginx)

#### 10.3 Frontend Deployment
- [ ] Build Next.js untuk production (`npm run build`)
- [ ] Deploy ke VPS (pm2 / systemd) atau Vercel/Netlify
- [ ] Setup CDN untuk static files (opsional tapi recommended)

#### 10.4 HTTPS & Security
- [ ] Install SSL certificate (Let's Encrypt / paid)
- [ ] Configure Nginx untuk HTTPS
- [ ] Redirect HTTP → HTTPS
- [ ] Security headers (HSTS, CSP, X-Frame-Options)
- [ ] CORS configuration

#### 10.5 Monitoring & Logging
- [ ] Setup centralized logging (ELK stack / Sentry)
- [ ] Monitoring server (Prometheus / New Relic)
- [ ] Alert untuk error critical
- [ ] Uptime monitoring

#### 10.6 Database Backup
- [ ] Automated backup daily → external storage (S3 / FTP)
- [ ] Test restore procedure
- [ ] Keep backup 30 hari

#### 10.7 Go-Live Preparation
- [ ] Briefing guru: cara input soal, atur jadwal
- [ ] Briefing siswa: cara login, cara ujian, fitur autosave
- [ ] Buat user guide / tutorial video
- [ ] Setup admin support hotline (chat/email)

#### 10.8 Soft Launch
- [ ] Go-live untuk ujian kecil dulu (1-2 kelas) dengan monitoring ketat
- [ ] Collect feedback
- [ ] Fix urgent bugs / tweak UX
- [ ] After 1-2 minggu stabil → full rollout ke semua kelas

### Output Fase 10:
✅ Sistem live & berjalan di production  
✅ Guru & siswa bisa pakai untuk ujian sesungguhnya  

---

## 📊 Timeline Ringkas

| Fase | Deskripsi | Durasi | Cumulative |
|------|-----------|--------|-----------|
| 0 | Persiapan | 1 minggu | 1 minggu |
| 1 | Backend & DB | 2 minggu | 3 minggu |
| 2 | Authentication | 1 minggu | 4 minggu |
| 3 | CRUD Master | 2 minggu | 6 minggu |
| 4 | Jadwal Ujian | 1 minggu | 7 minggu |
| 5 | **Mesin Ujian** | 3 minggu | **10 minggu** ← Critical phase |
| 6 | Scoring | 1 minggu | 11 minggu |
| 7 | Dashboard | 2 minggu | 13 minggu |
| 8 | Frontend | 4 minggu | 17 minggu |
| 9 | Testing | 2 minggu | 19 minggu |
| 10 | Deployment | 1 minggu | 20 minggu |

**Total: ±20 minggu (5 bulan) untuk solo dev**

Jika parallel (backend & frontend dikerjakan orang berbeda): **±3-3.5 bulan**

---

## 🎯 Prioritas Pengerjaan (Resume dari Main Goal)

Fokus pada urutan ini untuk cepat punya MVP yang bisa ditest:

1. ✅ **Setup backend + DB** → API bisa berjalan
2. ✅ **Auth (login/register)** → User bisa login
3. ✅ **CRUD soal & paket ujian** → Guru bisa input soal
4. ✅⭐ **Mesin ujian (random, timer, autosave, resume)** → **JANTUNG SISTEM** — harus matang!
5. ✅ **Scoring** → Nilai muncul otomatis

Setelah 5 poin di atas **benar-benar stabil** dan sudah testing ekstensif untuk skenario refresh/disconnect:

6. Dashboard & monitoring
7. Frontend lengkap & cantik
8. Fitur tambahan (analytics, export hasil, dll)

---

## 📝 Catatan Penting

### Do's:
✅ Mulai dari Phase 0 persiapan — jangan skip!  
✅ Phase 5 (Mesin Ujian) adalah priority utama — jangan hurry  
✅ Random urutan **harus disimpan ke DB** — jangan hitung ulang  
✅ Timer dari backend — client hanya tampil  
✅ Autosave setiap 5-10 detik — user merasa aman  
✅ Testing ekstensif skenario refresh/disconnect sebelum go-live  
✅ UAT dengan user asli sebelum go-live  

### Don'ts:
❌ Jangan skip Fase 0 persiapan  
❌ Jangan main-main sama timer (hitung dari client bisa dimanipulasi)  
❌ Jangan menyimpan random urutan hanya di browser (hilang saat refresh)  
❌ Jangan deploy ke production tanpa testing ekstensif  
❌ Jangan skip backup database  

---

## 🚀 Next Step: Fase 0 Checklist

👉 Lanjut ke [PHASE_0_CHECKLIST.md](./PHASE_0_CHECKLIST.md) untuk action items konkret Phase 0.

---

**Last Updated:** 2026-06-25  
**Project:** CBT Quantum Research  
**Status:** 🔴 Phase 0 - Persiapan
