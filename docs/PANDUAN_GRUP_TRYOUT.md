# Panduan Penggunaan Grouping Tryout

## Untuk Administrator

### 1. Membuat Grup Tryout

1. Buka halaman admin `/admin/jadwal-ujian`
2. Isi form "Tambah Grup Tryout"
   - **Nama grup**: Contoh "Tryout Matematika Kelas 12"
   - Klik "Simpan Grup"
3. Grup akan muncul di dropdown jadwal

### 2. Membuat Jadwal dengan Grup

1. Di form "Tambah Jadwal":
   - **ID paket ujian**: Masukkan ID paket yang sudah dibuat
   - **Pilih grup tryout**: Pilih grup dari dropdown
   - **Waktu mulai**: Pilih tanggal dan waktu mulai
   - **Waktu selesai**: Pilih tanggal dan waktu selesai
2. Klik "Simpan Jadwal"

**Catatan Penting:**
- Jadwal dalam grup yang sama **TIDAK BOLEH** overlap waktunya
- Jadwal di grup berbeda **BOLEH** menggunakan waktu yang sama
- Contoh VALID:
  - Grup MTK: Senin 08:00-10:00
  - Grup Fisika: Senin 08:00-10:00 ✅ (grup berbeda)
- Contoh INVALID:
  - Grup MTK: Senin 08:00-10:00
  - Grup MTK: Senin 09:00-11:00 ❌ (overlap dalam grup sama)

### 3. Melihat Jadwal Per Grup

1. Di bagian "Daftar Jadwal", pilih grup dari dropdown
2. Jadwal akan difilter sesuai grup yang dipilih
3. Pilih "Semua grup" untuk melihat semua jadwal

### 4. Menghapus Grup

- Grup yang **masih digunakan** oleh jadwal **TIDAK DAPAT** dihapus
- Hapus atau ubah semua jadwal di grup tersebut terlebih dahulu
- Gunakan endpoint `DELETE /grup-tryout/{id}` via API

## Untuk Siswa

### 1. Melihat Jadwal Tryout

1. Buka halaman `/siswa/jadwal-ujian`
2. Lihat daftar jadwal yang tersedia
3. Setiap jadwal menampilkan:
   - **Badge grup**: Nama grup tryout
   - **Nama paket**: Paket ujian
   - **Waktu**: Mulai dan selesai
   - **Status**: Mendatang/Berlangsung/Berakhir

### 2. Filter Jadwal Per Grup

1. Gunakan dropdown "Semua grup" di pojok kanan atas
2. Pilih grup untuk melihat jadwal grup tersebut saja
3. Pilih "Semua grup" untuk reset filter

### 3. Mengikuti Ujian

**PENTING:** 
- Saat start ujian, sistem akan memvalidasi grup tryout
- Anda hanya bisa ikut jadwal yang sesuai grup Anda
- Jika ada error "tidak sesuai grup", hubungi admin

## API Endpoints

### Grup Tryout

**List Grup:**
```http
GET /grup-tryout/
GET /grup-tryout/?is_active=true
```

**Create Grup:** (admin only)
```http
POST /grup-tryout/
Content-Type: application/json

{
  "nama": "Tryout Matematika",
  "deskripsi": "Grup tryout matematika",
  "is_active": true
}
```

**Update Grup:** (admin only)
```http
PUT /grup-tryout/{id}
Content-Type: application/json

{
  "nama": "Tryout Matematika Updated",
  "is_active": false
}
```

**Delete Grup:** (admin only)
```http
DELETE /grup-tryout/{id}
```

### Jadwal dengan Grup

**Create Jadwal dengan Grup:**
```http
POST /jadwal-ujian/
Content-Type: application/json

{
  "paket_ujian_id": 1,
  "mulai": "2026-08-13T08:00:00",
  "selesai": "2026-08-13T10:00:00",
  "is_published": true,
  "grup_tryout_id": 1,
  "program_id": null,
  "kelas_id": null
}
```

**Filter Jadwal Per Grup:**
```http
GET /jadwal-ujian/?grup_tryout_id=1
```

### Start Ujian dengan Grup

**Start Ujian:**
```http
POST /ujian-siswa/mulai
Content-Type: application/json

{
  "jadwal_ujian_id": 1,
  "grup_tryout_id": 1
}
```

**Response jika berhasil:**
```json
{
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

## Troubleshooting

### Error: "Jadwal ujian overlap dengan jadwal lain"
- **Penyebab**: Ada jadwal lain di grup yang sama dengan waktu overlap
- **Solusi**: Ubah waktu jadwal atau pilih grup berbeda

### Error: "Jadwal ujian tidak sesuai grup tryout"
- **Penyebab**: `grup_tryout_id` yang dikirim tidak cocok dengan grup jadwal
- **Solusi**: Pastikan menggunakan `grup_tryout_id` yang benar

### Error: "Grup tryout masih digunakan oleh jadwal ujian"
- **Penyebab**: Mencoba hapus grup yang masih dipakai jadwal
- **Solusi**: Hapus atau ubah semua jadwal di grup tersebut terlebih dahulu

### Error: "Nama grup tryout sudah digunakan"
- **Penyebab**: Nama grup duplikat
- **Solusi**: Gunakan nama yang berbeda

## FAQ

**Q: Apakah jadwal lama tanpa grup masih berfungsi?**  
A: Ya, backward compatible. Jadwal tanpa grup tetap berfungsi normal.

**Q: Berapa banyak grup yang bisa dibuat?**  
A: Tidak ada batasan, bisa sebanyak yang dibutuhkan.

**Q: Apakah satu siswa bisa ikut ujian di beberapa grup?**  
A: Ya, siswa bisa ikut ujian di berbagai grup sesuai jadwal.

**Q: Bagaimana cara memindahkan jadwal ke grup lain?**  
A: Edit jadwal dengan `PUT /jadwal-ujian/{id}` dan ubah `grup_tryout_id`.

**Q: Apakah jadwal tanpa grup bisa overlap dengan jadwal bergrup?**  
A: Ya, validasi overlap hanya berlaku antar jadwal dalam grup yang sama.
