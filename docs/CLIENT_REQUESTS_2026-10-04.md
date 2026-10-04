# Client Requests - 04 Oktober 2026

## Permintaan
1. Membersihkan (clear) seluruh data di VPS yang bersih, kecuali mempertahankan akun (Admin, Guru, Siswa).
2. Memperbarui dokumentasi.
3. Push perubahan ke GitHub.

## Eksekusi & Solusi

**1. Script Clear Data (Kecuali Akun)**
Telah dibuatkan script khusus `backend/scripts/clear_vps_data.py`. 
Script ini akan:
- Menghapus semua data transaksional dan soal (Paket, Soal, Ujian, Jawaban, Log, dll).
- Mempertahankan struktur dasar dan akun: `users`, `guru`, `siswa`, `kelas`, `program`, `pelajaran`.
- Menggunakan pendekatan *in-place model deletion* menggunakan SQLAlchemy sehingga constraint database tetap aman (tidak force hapus cascade).

**Cara eksekusi di VPS:**
1. Masuk ke environment python backend (contoh: `source venv/bin/activate`).
2. Jalankan: `python scripts/clear_vps_data.py`
3. Konfirmasi peringatan `y/n` yang muncul.

**2. Update Dokumentasi**
File ini (`docs/CLIENT_REQUESTS_2026-10-04.md`) berfungsi sebagai update dokumentasi permintaan terbaru.

**3. Push ke GitHub**
Kode dan skrip `clear_vps_data.py` langsung di-*commit* dan di-*push* ke repositori GitHub.
