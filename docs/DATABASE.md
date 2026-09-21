# 🗄️ Database Schema — CBT Quantum Research

Spesifikasi lengkap untuk semua tabel, kolom, tipe data, relasi, dan index.

---

## Tabel: `users`

**Deskripsi:** Master user untuk login (admin, guru, siswa)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Username login |
| password_hash | VARCHAR(255) | NOT NULL | Hash password (bcrypt) |
| role | ENUM('admin','guru','siswa') | NOT NULL | Role akun |
| created_at | TIMESTAMP | DEFAULT now() | Waktu buat |
| updated_at | TIMESTAMP | DEFAULT now() | Waktu update |
| is_active | BOOLEAN | DEFAULT true | Status aktif/nonaktif |

**Index:**
- UNIQUE(username)
- INDEX(role)
- INDEX(is_active)

**Notes:**
- Password di-hash dengan bcrypt, jangan simpan plain text
- `role` menentukan akses level

---

## Tabel: `siswa`

**Deskripsi:** Data siswa (extension dari users untuk role='siswa')

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| user_id | INT | FK → users, NOT NULL | Reference ke users |
| nama_lengkap | VARCHAR(100) | NOT NULL | Nama lengkap siswa |
| no_induk | VARCHAR(20) | UNIQUE | Nomor induk/NIS |
| program_id | INT | FK → program, NOT NULL | Program yang diikuti |
| kelas_id | INT | FK → kelas | Kelas siswa |
| email | VARCHAR(100) | | Email siswa |
| no_hp | VARCHAR(15) | | Nomor HP |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- UNIQUE(no_induk)
- INDEX(program_id)
- INDEX(kelas_id)
- INDEX(user_id)

**Notes:**
- `program_id` wajib untuk filter jadwal ujian & hasil
- `kelas_id` opsional tapi recommended untuk managing group

---

## Tabel: `program`

**Deskripsi:** Program ujian (TKA, SNBT, Speedtest, Ujian Mandiri)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| nama | VARCHAR(50) | UNIQUE, NOT NULL | Nama program |
| deskripsi | TEXT | | Penjelasan program |
| level | ENUM('smp','sma') | DEFAULT 'sma' | Level target |
| is_active | BOOLEAN | DEFAULT true | Status aktif |
| created_at | TIMESTAMP | DEFAULT now() | |

**Data seeding (predefined):**
```
1, 'TKA', 'Tes Kemampuan Akademik', 'sma', true
2, 'SNBT', 'Seleksi Nasional Berdasarkan Tes', 'sma', true
3, 'Speedtest', 'Speedtest', 'sma', true
4, 'Ujian Mandiri', 'Ujian Mandiri', 'sma', true
5, 'TKA', 'Tes Kemampuan Akademik', 'smp', true
6, 'Speedtest', 'Speedtest', 'smp', true
```

**Index:**
- UNIQUE(nama, level)

---

## Tabel: `kelas`

**Deskripsi:** Kelas siswa (Kelas 12, Kelas 11, dll)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| nama | VARCHAR(50) | NOT NULL | Nama kelas |
| program_id | INT | FK → program, NOT NULL | Program kelas |
| guru_id | INT | FK → users (role='guru') | Guru pengajar |
| level | ENUM('smp','sma') | NOT NULL | Level |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(program_id)
- INDEX(guru_id)

**Notes:**
- Satu kelas bisa punya multiple guru (buat tabel junction jika perlu)

---

## Tabel: `pelajaran`

**Deskripsi:** Mata pelajaran (Matematika, IPA, Bahasa, dll)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| nama | VARCHAR(100) | NOT NULL | Nama pelajaran |
| program_id | INT | FK → program, NOT NULL | Program terkait |
| deskripsi | TEXT | | Penjelasan |
| kode | VARCHAR(20) | | Kode pelajaran |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(program_id)
- UNIQUE(nama, program_id)

---

## Tabel: `paket_ujian`

**Deskripsi:** Kumpulan soal yang menjadi satu paket ujian

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| nama | VARCHAR(100) | NOT NULL | Nama paket ujian |
| program_id | INT | FK → program, NOT NULL | Program terkait |
| deskripsi | TEXT | | Penjelasan paket |
| durasi_menit | INT | NOT NULL, CHECK > 0 | Durasi ujian (menit) |
| jumlah_soal | INT | NOT NULL, CHECK > 0 | Jumlah soal dalam paket |
| tipe_soal | ENUM('pilihan_ganda') | DEFAULT 'pilihan_ganda' | Tipe soal |
| is_random_soal | BOOLEAN | DEFAULT true | Random urutan soal? |
| is_random_opsi | BOOLEAN | DEFAULT true | Random urutan opsi? |
| passing_score | INT | DEFAULT 60 | Nilai minimum lulus (%) |
| created_by | INT | FK → users | Dibuat oleh guru/admin |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | DEFAULT now() | |
| is_active | BOOLEAN | DEFAULT true | Status aktif |

**Index:**
- INDEX(program_id)
- INDEX(created_by)

**Notes:**
- `durasi_menit` perlu di-validate agar tidak 0 atau negatif
- `jumlah_soal` adalah jumlah soal yang muncul (dari total soal yang ada)
- Random flags penting untuk fitur randomisasi

---

## Tabel: `soal`

**Deskripsi:** Soal ujian

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| paket_ujian_id | INT | FK → paket_ujian, NOT NULL | Paket ujian terkait |
| pelajaran_id | INT | FK → pelajaran, NOT NULL | Pelajaran terkait |
| teks_soal | LONGTEXT | NOT NULL | Isi soal (HTML + LaTeX) |
| tipe | ENUM('pilihan_ganda','essay','true_false') | DEFAULT 'pilihan_ganda' | Tipe soal |
| bobot | INT | DEFAULT 1 | Bobot skor soal |
| gambar_url | VARCHAR(500) | | URL gambar soal (jika ada) |
| tingkat_kesulitan | ENUM('mudah','sedang','sulit') | | Level kesulitan |
| urutan | INT | NOT NULL | Urutan soal dalam paket |
| penjelasan | LONGTEXT | | Penjelasan/pembahasan soal |
| created_by | INT | FK → users | Dibuat oleh |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(paket_ujian_id)
- INDEX(pelajaran_id)
- UNIQUE(paket_ujian_id, urutan)

**Notes:**
- `teks_soal` simpan sebagai HTML (dari rich text editor) + LaTeX untuk rumus
- `gambar_url` link ke CDN atau server
- `urutan` unique per paket (1, 2, 3, ...)

---

## Tabel: `opsi_jawaban`

**Deskripsi:** Pilihan jawaban untuk soal pilihan ganda

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| soal_id | INT | FK → soal, NOT NULL | Soal terkait |
| teks_opsi | TEXT | NOT NULL | Isi opsi jawaban (HTML) |
| is_benar | BOOLEAN | DEFAULT false | Apakah jawaban benar? |
| urutan | INT | NOT NULL | Urutan opsi (A, B, C, D, E) |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(soal_id)
- UNIQUE(soal_id, urutan)

**Notes:**
- Setiap soal minimal 2 opsi, maksimal 5 opsi (recommendation)
- Hanya 1 opsi yang `is_benar`
- `urutan` bisa 1-5 untuk A-E

---

## Tabel: `jadwal_ujian`

**Deskripsi:** Jadwal kapan ujian berlangsung

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| paket_ujian_id | INT | FK → paket_ujian, NOT NULL | Paket ujian |
| kelas_id | INT | FK → kelas | Kelas (opsional, jika untuk 1 kelas) |
| nama_jadwal | VARCHAR(100) | NOT NULL | Nama jadwal |
| waktu_mulai | TIMESTAMP | NOT NULL | Waktu mulai ujian |
| waktu_selesai | TIMESTAMP | NOT NULL | Waktu selesai ujian |
| is_tersedia | BOOLEAN | DEFAULT true | Apakah jadwal aktif? |
| max_siswa | INT | | Max siswa yang bisa ujian (opsional) |
| created_by | INT | FK → users | Dibuat oleh admin |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(paket_ujian_id)
- INDEX(kelas_id)
- INDEX(waktu_mulai)
- INDEX(is_tersedia)

**Notes:**
- `waktu_mulai` < `waktu_selesai` (validate di app)
- `is_tersedia` untuk soft delete jadwal
- Cek overlap jadwal saat insert/update

---

## Tabel: `ujian_siswa`

**Deskripsi:** Instance ujian per siswa (setiap kali siswa ambil ujian)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| siswa_id | INT | FK → siswa, NOT NULL | Siswa pengambil |
| jadwal_ujian_id | INT | FK → jadwal_ujian, NOT NULL | Jadwal ujian |
| paket_ujian_id | INT | FK → paket_ujian | Copy paket saat diambil |
| status | ENUM('belum_mulai','sedang','submit','timeout','dibatalkan') | DEFAULT 'belum_mulai' | Status ujian |
| waktu_mulai | TIMESTAMP | | Waktu siswa mulai ujian |
| waktu_selesai_real | TIMESTAMP | | Waktu siswa selesai/submit ujian |
| durasi_diambil_detik | INT | | Durasi waktu yang diambil (detik) |
| soal_urutan_json | JSON | | Urutan soal yang sudah di-random [45, 12, 89, ...] |
| opsi_urutan_json | JSON | | Urutan opsi per soal {45: [2,4,1,3], ...} |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(siswa_id)
- INDEX(jadwal_ujian_id)
- INDEX(status)
- INDEX(created_at)

**Notes:**
- `soal_urutan_json` & `opsi_urutan_json` simpan urutan random — sangat penting untuk konsistensi saat refresh!
- `status` track progress ujian
- `waktu_selesai_real` catat kapan siswa finish/submit

---

## Tabel: `jawaban_siswa`

**Deskripsi:** Jawaban yang diberikan siswa per soal

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| ujian_siswa_id | INT | FK → ujian_siswa, NOT NULL | Ujian terkait |
| soal_id | INT | FK → soal, NOT NULL | Soal |
| opsi_jawaban_id | INT | FK → opsi_jawaban | Opsi yang dipilih (NULL jika tidak dijawab) |
| waktu_dijawab | TIMESTAMP | | Waktu siswa menjawab |
| updated_at | TIMESTAMP | DEFAULT now() ON UPDATE | Last update |

**Index:**
- UNIQUE(ujian_siswa_id, soal_id)
- INDEX(opsi_jawaban_id)

**Notes:**
- `opsi_jawaban_id` bisa NULL jika siswa belum menjawab soal ini
- `waktu_dijawab` untuk analytics (saat siswa serius menjawab)
- Tabel ini simpan jawaban siswa — paling penting untuk scoring!

---

## Tabel: `hasil_ujian`

**Deskripsi:** Nilai & hasil ujian siswa

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| ujian_siswa_id | INT | FK → ujian_siswa, NOT NULL | Ujian terkait |
| skor_total | DECIMAL(5,2) | | Skor total (%) |
| skor_per_pelajaran_json | JSON | | Breakdown skor per pelajaran |
| jumlah_benar | INT | | Jumlah soal benar |
| jumlah_salah | INT | | Jumlah soal salah |
| jumlah_kosong | INT | | Jumlah soal tidak dijawab |
| is_lulus | BOOLEAN | | Lulus atau tidak (berdasarkan passing_score) |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(ujian_siswa_id)
- INDEX(is_lulus)

**Notes:**
- Nilai ini di-generate otomatis setelah ujian selesai (Phase 6)
- `skor_per_pelajaran_json`: {"Matematika": 80, "IPA": 75, ...}

---

## Tabel: `log_kecurangan`

**Deskripsi:** Log aktivitas mencurigakan saat ujian

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| ujian_siswa_id | INT | FK → ujian_siswa, NOT NULL | Ujian terkait |
| tipe | VARCHAR(50) | NOT NULL | Tipe kecurangan |
| deskripsi | TEXT | | Detail deskripsi |
| created_at | TIMESTAMP | DEFAULT now() | |

**Index:**
- INDEX(ujian_siswa_id)
- INDEX(tipe)

**Tipe Kecurangan:**
- `tab_blur` — tab browser kehilangan fokus
- `tab_focus` — tab kembali fokus
- `fullscreen_exit` — keluar dari fullscreen
- `copy_attempt` — coba copy text
- `right_click` — klik kanan
- `inspector_open` — buka developer tools
- `login_ganda` — login 2 device bersamaan

**Notes:**
- Log ini untuk monitoring, guru/admin lihat nanti
- Jangan hard-kick user, biarkan guru yang putuskan

---

## Tabel: `sesi_login`

**Deskripsi:** Track sesi login siswa (antisipasi joki ujian)

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| siswa_id | INT | FK → siswa, NOT NULL | Siswa |
| device_id | VARCHAR(100) | | ID device (UUID) |
| ip_address | VARCHAR(50) | | IP address login |
| user_agent | VARCHAR(500) | | User agent browser |
| login_time | TIMESTAMP | DEFAULT now() | Waktu login |
| logout_time | TIMESTAMP | | Waktu logout |
| is_valid | BOOLEAN | DEFAULT true | Valid login atau suspicious? |

**Index:**
- INDEX(siswa_id)
- INDEX(login_time)

**Notes:**
- Catat setiap login — bisa detect login dari lokasi/device berbeda
- `device_id` bisa generate dari fingerprint browser (opsional)

---

## Tabel: `pengaturan`

**Deskripsi:** Konfigurasi sistem global

| Kolom | Tipe | Constraint | Deskripsi |
|-------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID unique |
| kunci | VARCHAR(100) | UNIQUE, NOT NULL | Key setting |
| nilai_json | JSON | NOT NULL | Value setting (JSON) |
| tipe | ENUM('string','int','boolean','json') | DEFAULT 'string' | Tipe value |
| deskripsi | TEXT | | Penjelasan setting |
| updated_by | INT | FK → users | Siapa update terakhir |
| updated_at | TIMESTAMP | DEFAULT now() ON UPDATE | Last update |

**Index:**
- UNIQUE(kunci)

**Data Seeding (Contoh):**
```
1, 'app_name', '"Quantum Research CBT"', 'string', 'Nama aplikasi'
2, 'app_logo_url', '"https://cdn.example.com/logo.png"', 'string', 'URL logo'
3, 'app_description', '"Sistem CBT untuk Bimbel Quantum Research"', 'string', 'Deskripsi app'
4, 'enable_exam_timer', 'true', 'boolean', 'Aktifkan timer ujian'
5, 'show_result_immediately', 'true', 'boolean', 'Tampilkan hasil langsung?'
6, 'autosave_interval_second', '5', 'int', 'Interval autosave (detik)'
7, 'max_login_attempts', '5', 'int', 'Max percobaan login'
8, 'contact_email', '"admin@quantumresearch.id"', 'string', 'Email kontak'
```

---

## Relasi Summary

```
users (1) ──→ (N) siswa
         ──→ (N) sesi_login
         ──→ (N) log_kecurangan
         ──→ (N) paket_ujian (created_by)
         ──→ (N) soal (created_by)

siswa (1) ──→ (N) ujian_siswa
      ──→ (1) program
      ──→ (1) kelas (optional)

program (1) ──→ (N) siswa
        ──→ (N) pelajaran
        ──→ (N) paket_ujian
        ──→ (N) kelas

paket_ujian (1) ──→ (N) soal
            ──→ (N) jadwal_ujian

soal (1) ──→ (N) opsi_jawaban
     ──→ (N) jawaban_siswa

jadwal_ujian (1) ──→ (N) ujian_siswa

ujian_siswa (1) ──→ (N) jawaban_siswa
            ──→ (1) hasil_ujian
            ──→ (N) log_kecurangan

jawaban_siswa (N) ──→ (1) opsi_jawaban
```

---

## Design Rationale

### Mengapa JSON untuk urutan random?

```sql
-- Saat ujian mulai, simpan urutan di sini:
soal_urutan_json: [45, 12, 89, 34, ...]
opsi_urutan_json: {45: [2,4,1,3], 12: [3,1,4,2], ...}

-- Keuntungan:
-- ✅ Cepat retrieve (1 query)
-- ✅ Konsisten saat refresh (urutan tidak regenerate)
-- ✅ Fleksibel (bisa extend dengan metadata lain)

-- Alternati: junction table (tapi kompleks)
```

### Mengapa `is_random_soal` & `is_random_opsi` di `paket_ujian`?

```sql
-- Guru bisa set: apakah soal random per siswa atau sama semua?
-- Ini fitur flexibility:
-- - TKA: soal + opsi random per siswa (prevent cheating)
-- - Speedtest: soal random tapi opsi sama (lebih konsisten)
```

### Mengapa `skor_per_pelajaran_json`?

```sql
-- Ujian bisa punya soal dari multiple pelajaran
-- Breakdown skor per pelajaran important untuk analytics

-- Contoh:
skor_per_pelajaran_json: {
  "Matematika": {skor: 85, benar: 17, total: 20},
  "Bahasa": {skor: 90, benar: 18, total: 20}
}
```

---

## Migration Script (Alembic)

Nanti di Phase 1, generate migration dengan Alembic:

```bash
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

## Performance Considerations

- **Index semua FK** — penting untuk query join
- **Index timestamp** — untuk filter by date range
- **Partition huge tables** (e.g., `jawaban_siswa`) — nanti kalau data besar (millions rows)
- **Denormalization carefully** — `skor_per_pelajaran_json` & `soal_urutan_json` adalah contoh denormalization for speed

---

**This schema designed for:**
✅ Scalability — bisa handle ribuan siswa ujian bersamaan  
✅ Integrity — foreign key constraints ketat  
✅ Performance — index strategis, JSON untuk flexibility  
✅ Auditability — timestamps & created_by tracking  

---

Last Updated: 2026-06-25
