# Quick Reference - CBT API Endpoints

**Last Updated:** 2026-08-12  
**Base URL:** `http://localhost:8000` (development)

---

## 🔐 Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

Response: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Register (Admin Only)
```http
POST /auth/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "role": "siswa"  // "admin" | "guru" | "siswa"
}
```

### Other Auth Endpoints
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/change-password` - Change password
- `POST /auth/reset-password` - Reset password
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout

---

## 👥 Master Data

### Program
- `GET /program/` - List all programs
- `POST /program/` - Create program (admin/guru)
- `GET /program/{id}` - Get program detail
- `PUT /program/{id}` - Update program (admin/guru)
- `DELETE /program/{id}` - Delete program (admin/guru)

### Kelas
- `GET /kelas/` - List all kelas
- `POST /kelas/` - Create kelas (admin/guru)
- `GET /kelas/{id}` - Get kelas detail
- `PUT /kelas/{id}` - Update kelas (admin/guru)
- `DELETE /kelas/{id}` - Delete kelas (admin/guru)

### Pelajaran
- `GET /pelajaran/` - List all pelajaran
- `POST /pelajaran/` - Create pelajaran (admin/guru)
- `GET /pelajaran/{id}` - Get pelajaran detail
- `PUT /pelajaran/{id}` - Update pelajaran (admin/guru)
- `DELETE /pelajaran/{id}` - Delete pelajaran (admin/guru)

### Siswa
- `GET /siswa/` - List all siswa (admin/guru)
- `POST /siswa/` - Create siswa profile
- `GET /siswa/{id}` - Get siswa detail
- `PUT /siswa/{id}` - Update siswa
- `DELETE /siswa/{id}` - Delete siswa (admin)
- `GET /siswa/dashboard` - Get siswa dashboard (authenticated)
- `GET /siswa/jadwal-ujian` - Get jadwal for current siswa
- `GET /siswa/riwayat-ujian` - Get riwayat ujian siswa

---

## 🆕 Grup Tryout (New Feature)

### CRUD Grup Tryout
```http
# List Grup
GET /grup-tryout/
GET /grup-tryout/?is_active=true

Response: [
  {
    "id": 1,
    "nama": "Tryout Matematika",
    "deskripsi": "Grup tryout matematika",
    "is_active": true,
    "created_at": "2026-08-12T10:00:00Z"
  }
]

# Create Grup (Admin Only)
POST /grup-tryout/
Authorization: Bearer {token}
Content-Type: application/json

{
  "nama": "Tryout Matematika",
  "deskripsi": "Grup tryout matematika",
  "is_active": true
}

# Get Grup Detail
GET /grup-tryout/{id}

# Update Grup (Admin Only)
PUT /grup-tryout/{id}
Content-Type: application/json

{
  "nama": "Tryout Matematika Updated",
  "is_active": false
}

# Delete Grup (Admin Only)
DELETE /grup-tryout/{id}
```

**Notes:**
- Nama grup harus unik
- Grup yang masih digunakan jadwal tidak bisa dihapus
- Only admin can create/update/delete grup

---

## 📦 Paket Ujian

### Endpoints
- `GET /paket-ujian/` - List all paket
- `POST /paket-ujian/` - Create paket (admin/guru)
- `GET /paket-ujian/{id}` - Get paket detail
- `PUT /paket-ujian/{id}` - Update paket (admin/guru)
- `DELETE /paket-ujian/{id}` - Delete paket (admin/guru)
- `POST /paket-ujian/{id}/clone` - Clone paket (admin/guru)

### Create Paket Example
```http
POST /paket-ujian/
Content-Type: application/json

{
  "nama": "Tryout UTBK 2026",
  "deskripsi": "Paket tryout UTBK",
  "durasi_menit": 120,
  "jumlah_soal": 60,
  "is_random_soal": true,
  "is_random_opsi": true
}
```

---

## 📝 Soal & Opsi Jawaban

### Soal
- `GET /soal/` - List soal (with filters)
- `POST /soal/` - Create soal (admin/guru)
- `GET /soal/{id}` - Get soal detail
- `PUT /soal/{id}` - Update soal (admin/guru)
- `DELETE /soal/{id}` - Delete soal (admin/guru)

### Opsi Jawaban
- `GET /opsi-jawaban/?soal_id={id}` - List opsi for soal
- `POST /opsi-jawaban/` - Create opsi (admin/guru)
- `GET /opsi-jawaban/{id}` - Get opsi detail
- `PUT /opsi-jawaban/{id}` - Update opsi (admin/guru)
- `DELETE /opsi-jawaban/{id}` - Delete opsi (admin/guru)

---

## 📅 Jadwal Ujian (with Grouping Support)

### Create Jadwal with Grup
```http
POST /jadwal-ujian/
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "paket_ujian_id": 1,
  "mulai": "2026-08-13T08:00:00",
  "selesai": "2026-08-13T10:00:00",
  "is_published": true,
  "grup_tryout_id": 1,       // NEW: Optional grup ID
  "program_id": null,
  "kelas_id": null
}

Response: {
  "id": 1,
  "paket_ujian_id": 1,
  "mulai": "2026-08-13T08:00:00Z",
  "selesai": "2026-08-13T10:00:00Z",
  "is_published": true,
  "grup_tryout_id": 1,        // NEW: Grup ID
  "program_id": null,
  "kelas_id": null
}
```

### List & Filter Jadwal
```http
# List all jadwal
GET /jadwal-ujian/

# Filter by grup (NEW)
GET /jadwal-ujian/?grup_tryout_id=1

# Filter by paket, program, kelas
GET /jadwal-ujian/?paket_ujian_id=1&program_id=1&kelas_id=1&is_published=true
```

### Other Jadwal Endpoints
- `GET /jadwal-ujian/{id}` - Get jadwal detail
- `PUT /jadwal-ujian/{id}` - Update jadwal (admin)
- `DELETE /jadwal-ujian/{id}` - Soft delete jadwal (admin)
- `GET /jadwal-ujian/{id}/siswa` - List eligible siswa

**Overlap Validation:**
- ✅ Jadwal dalam grup yang sama **TIDAK BOLEH** overlap
- ✅ Jadwal di grup berbeda **BOLEH** overlap
- ✅ Jadwal tanpa grup (legacy) tetap berfungsi

---

## 📝 Ujian Siswa (with Grup Validation)

### Start/Resume Ujian
```http
POST /ujian-siswa/mulai
Authorization: Bearer {siswa-token}
Content-Type: application/json

{
  "jadwal_ujian_id": 1,
  "grup_tryout_id": 1,        // NEW: Required if jadwal has grup
  "siswa_id": null            // Optional for non-siswa users
}

Response: {
  "ujian_siswa_id": 123,
  "jadwal_ujian_id": 1,
  "soal_urutan": [5, 2, 8, 1],
  "waktu_mulai": "2026-08-13T08:05:00Z",
  "waktu_selesai": "2026-08-13T10:05:00Z",
  "durasi_menit": 120,
  "jumlah_soal": 40,
  "sisa_waktu_detik": 7140
}
```

**Validation Rules:**
- ✅ `grup_tryout_id` must match jadwal's grup
- ❌ Start without grup for grouped jadwal → HTTP 400
- ❌ Start with wrong grup → HTTP 400
- ✅ Resume returns same `ujian_siswa_id`

### Get Soal
```http
GET /ujian-siswa/{ujian_id}/soal/{nomor_urut}
Authorization: Bearer {siswa-token}

Response: {
  "soal_id": 5,
  "teks_soal": "2 + 2 = ?",
  "tipe": "pilihan_ganda",
  "opsi_urutan": [12, 15, 13, 14],
  "opsi": [
    {"opsi_id": 12, "teks": "3", "posisi": 0},
    {"opsi_id": 15, "teks": "4", "posisi": 1},
    {"opsi_id": 13, "teks": "5", "posisi": 2},
    {"opsi_id": 14, "teks": "2", "posisi": 3}
  ],
  "jawaban_user": null
}
```

### Save Answer
```http
POST /ujian-siswa/{ujian_id}/jawab
Content-Type: application/json

{
  "soal_id": 5,
  "opsi_jawaban_id": 15
}
```

### Other Ujian Endpoints
- `GET /ujian-siswa/` - List ujian (with filters)
- `GET /ujian-siswa/{id}` - Get ujian detail
- `GET /ujian-siswa/{id}/state` - Get full state (for resume)
- `GET /ujian-siswa/{id}/sisa-waktu` - Get remaining time
- `PATCH /ujian-siswa/{id}/submit` - Submit ujian
- `POST /ujian-siswa/{id}/log-kecurangan` - Log cheating

---

## 📊 Hasil Ujian

### Endpoints
- `GET /hasil-ujian/` - List hasil (with filters)
- `GET /hasil-ujian/{id}` - Get hasil detail
- `DELETE /hasil-ujian/{id}` - Delete hasil (admin)

### Example Response
```json
{
  "id": 1,
  "ujian_siswa_id": 123,
  "skor": 85.5,
  "breakdown": {
    "Matematika": 90,
    "Fisika": 80,
    "Kimia": 87
  },
  "calculated_at": "2026-08-13T10:05:30Z"
}
```

---

## 📈 Dashboard & Monitoring

### Admin Dashboard
```http
GET /dashboard/admin
Authorization: Bearer {admin-token}

Response: {
  "total_siswa": 150,
  "total_paket": 25,
  "total_jadwal": 40,
  "total_ujian_aktif": 12,
  "total_ujian_selesai": 320
}
```

### Monitoring Ujian
```http
GET /dashboard/monitoring-ujian
Authorization: Bearer {admin-token}

Response: [
  {
    "ujian_siswa_id": 123,
    "siswa_nama": "John Doe",
    "paket_nama": "UTBK 2026",
    "started_at": "2026-08-13T08:05:00Z",
    "sisa_waktu_detik": 5400,
    "status": "sedang"
  }
]
```

### Hasil Siswa (Dashboard)
```http
GET /dashboard/hasil-siswa
Query params: ?siswa_id=1&paket_ujian_id=1

Response: [
  {
    "siswa_nama": "John Doe",
    "paket_nama": "UTBK 2026",
    "skor": 85.5,
    "finished_at": "2026-08-13T10:05:00Z"
  }
]
```

---

## 🔧 Settings

### Pengaturan
- `GET /pengaturan/` - List all settings
- `POST /pengaturan/` - Create setting (admin)
- `GET /pengaturan/{id}` - Get setting detail
- `PUT /pengaturan/{id}` - Update setting (admin)
- `DELETE /pengaturan/{id}` - Delete setting (admin)

---

## 📋 New Fields Summary

### JadwalUjian (Updated)
```typescript
{
  id: number
  paket_ujian_id: number
  mulai: datetime
  selesai: datetime
  is_published: boolean
  program_id: number | null
  kelas_id: number | null
  grup_tryout_id: number | null  // NEW
}
```

### UjianSiswaStartRequest (Updated)
```typescript
{
  jadwal_ujian_id: number
  siswa_id: number | null
  grup_tryout_id: number | null  // NEW
}
```

### SiswaJadwalUjianOut (Updated)
```typescript
{
  jadwal_ujian_id: number
  paket_ujian_id: number
  nama_paket: string
  mulai: datetime
  selesai: datetime
  is_published: boolean
  status: string
  grup_tryout_id: number | null        // NEW
  nama_grup_tryout: string | null      // NEW
}
```

### SiswaRiwayatUjianOut (Updated)
```typescript
{
  ujian_siswa_id: number
  paket_ujian_id: number
  nama_paket: string
  jadwal_ujian_id: number | null
  started_at: datetime | null
  finished_at: datetime | null
  is_submitted: boolean
  skor: float | null
  grup_tryout_id: number | null        // NEW
  nama_grup_tryout: string | null      // NEW
}
```

---

## 🚀 Frontend Routes (New)

### Admin
- `/admin/jadwal-ujian` - Manage grup tryout and jadwal

### Siswa
- `/siswa/jadwal-ujian` - View jadwal with grup filter
- `/siswa/dashboard` - Dashboard (existing)

---

## 📚 Documentation Links

- **User Guide:** `docs/PANDUAN_GRUP_TRYOUT.md`
- **Verification:** `VERIFIKASI_GRUP_TRYOUT.md`
- **Implementation:** `IMPLEMENTASI_GRUP_TRYOUT_FINAL.md`
- **Progress:** `docs/PROGRESS_TRACKER.md`

---

## 🔑 Key Changes (2026-08-12)

1. **Grouping Tryout Feature:**
   - New table: `grup_tryout`
   - New FK: `jadwal_ujian.grup_tryout_id` (nullable)
   - Overlap validation per group
   - Start ujian requires matching grup

2. **Backward Compatible:**
   - Legacy jadwal without grup still works
   - No breaking changes for existing functionality

3. **New Endpoints:**
   - `POST /grup-tryout/` - Create grup
   - `GET /grup-tryout/` - List grup
   - `GET /grup-tryout/{id}` - Get grup
   - `PUT /grup-tryout/{id}` - Update grup
   - `DELETE /grup-tryout/{id}` - Delete grup

4. **Enhanced Endpoints:**
   - `POST /jadwal-ujian/` - Now accepts `grup_tryout_id`
   - `GET /jadwal-ujian/` - Now filterable by `grup_tryout_id`
   - `POST /ujian-siswa/mulai` - Now requires `grup_tryout_id` for grouped jadwal

---

**Questions?** See documentation or contact admin.
