# Audit dan QA lokal — 16 September 2026

## Pembaruan 18 September 2026

- Suite lengkap: **73 passed** (113,71 detik).
- Setelah penyelarasan durasi total dan penutupan endpoint jadwal guru lama:
  **12 tes terkait lulus** (17,99 detik).
- `npx tsc --noEmit` dan `npm run build`: **lulus**.
- Smoke lokal melalui proxy: login siswa dummy, daftar latihan, jadwal tersedia,
  dan riwayat semuanya HTTP 200. OpenAPI memuat endpoint penugasan baru.
- Migrasi penugasan diterapkan setelah backup
  `dev-local.before-client-17-20260918-150145.db`.
- Tes terbaru mencakup drilling yang tetap aktif setelah 30 hari tanpa timer,
  pembahasan hanya setelah jawaban terisi dan hanya pada drilling, pemisahan sesi
  antar-mode, akses kembali mapel UTBK, penugasan paket dan durasi guru, larangan
  pembuatan paket/jadwal oleh guru, serta penggantian revisi hanya sebelum mulai.
- Browser interaktif dan PostgreSQL produksi belum diuji. Penilaian biasa tetap
  digunakan; skor kohort belum diaktifkan sesuai arahan client.
- Panduan uji: [CLIENT_REQUESTS_2026-09-18.md](CLIENT_REQUESTS_2026-09-18.md).

## Pembaruan sebelumnya — 17 September 2026

Validasi lanjutan kebutuhan client:

- Suite backend lengkap: **70 passed** (124,28 detik).
- Build frontend sesudah penambahan Latihan, filter, jurusan dan perpindahan mapel: **lulus**.
- Tes fitur baru mencakup resume/ulang Latihan tanpa jadwal, riwayat Tryout saja,
  penguncian bagian Tryout, admin-only pilihan jurusan, serta migrasi yang mempertahankan data.
- Login siswa dummy melalui proxy frontend dan GET Latihan, riwayat, jadwal,
  profil: **HTTP 200**; satu paket Latihan lokal tersedia.
- Speedtest lama diarsipkan; IRT/drill belum aktif karena spesifikasi belum ada.
- Uji interaktif browser dan PostgreSQL produksi belum dijalankan.

Validasi tahap sebelumnya:

- `python -m pytest -q`: **65 passed**, 118,03 detik, SQLite tes terisolasi.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus, 36 halaman statis serta rute dinamis.
- Regresi baru memeriksa timezone UTC dan sisa waktu sesi baru, revisi lintas
  guru dengan pembatasan penugasan, sumber approved tetap utuh, guru tidak
  bisa approve, dan urutan soal terbaru dahulu.
- Pemilihan campuran menggunakan generator per tingkat yang sudah ada;
  verifikasi interaktif komposisi di browser masih diperlukan.
- Ruang lingkup client terbaru dan pekerjaan tersisa:
  [CLIENT_REQUESTS_2026-09-17.md](CLIENT_REQUESTS_2026-09-17.md).

## Ruang lingkup

Audit status README terhadap implementasi, pengujian API backend dengan SQLite
sementara, pemeriksaan TypeScript, dan build produksi frontend. Pengujian ini
belum mencakup PostgreSQL produksi, browser end-to-end, maupun beban 100 siswa.

## Perbaikan aplikasi

- Perbaikan 401 pada jadwal/paket/program: route koleksi tanpa slash sebelumnya
  menghasilkan redirect absolut dari FastAPI ke port 8000. Browser melepas
  Authorization ketika mengikuti redirect lintas origin. Rewrite Next.js kini
  menerima bentuk dengan/tanpa slash dan meneruskannya ke path backend yang
  kanonis. Normalisasi slash bawaan Next dinonaktifkan agar tidak membuat loop.
  Diverifikasi melalui server lokal: login, 20 route koleksi pada kedua bentuk
  URL, akses anonim ditolak, dan refresh token untuk admin/guru/siswa semuanya
  lolos. Pesan console listener asynchronous belum dikonfirmasi sumbernya.

  Regresi proxy dapat dijalankan dari frontend dengan `npm run test:proxy`.
  Set `PROXY_TEST_USERNAME` dan `PROXY_TEST_PASSWORD` ke akun uji yang tersedia.
  Script membaca OpenAPI sehingga route koleksi baru yang belum terpetakan
  dalam rewrite akan terdeteksi. Kedua server lokal harus berjalan.

- Normalisasi waktu UTC pada percobaan login dan masa berlaku refresh token.
  SQLite mengembalikan datetime tanpa zona waktu; sebelumnya perbandingan
  dengan waktu UTC dapat menyebabkan HTTP 500.
- Logout membatalkan access token melalui `token_version` dan mencabut seluruh
  refresh session pengguna. Konsekuensi: logout berlaku pada semua perangkat
  pengguna tersebut.
- Endpoint `/opsi-jawaban` untuk admin/guru mengembalikan `is_benar` dan
  pembahasan menggunakan schema staf. Pembatasan role dan kepemilikan tetap
  diterapkan; endpoint siswa tidak diubah.

## Perbaikan pengujian

- `backend/tests/conftest.py` mengarahkan aplikasi ke SQLite sementara sebelum
  modul aplikasi dimuat, membuat ulang schema untuk setiap tes, serta menutup
  seluruh session sebelum cleanup. Database lokal dari `.env` tidak digunakan.
- Data program, jadwal aktif, admin, dan bank soal yang dibutuhkan tes dibuat
  oleh tes sendiri. Tidak bergantung pada akun atau data development.
- Menghapus referensi `login_attempts` lama dan login saat import modul tes.
- Menyesuaikan tes dengan program wajib, soal approved, pembatasan peserta,
  signature upload gambar, dan proteksi penghapusan soal yang masih dipakai.
- Menambahkan regresi retry login, rate limiting, rotasi refresh token, dan
  pencabutan keluarga token ketika token lama digunakan ulang.

## Menjalankan pemeriksaan

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q --tb=short
```

```powershell
cd frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

Hentikan `next dev` saat menjalankan build karena keduanya menulis ke `.next`.
Jalankan kembali `npm.cmd run dev` setelah build selesai.

## Hasil

- TypeScript: lolos.
- Build Next.js: lolos, 35 halaman statis dihasilkan; route dinamis juga dibangun.
- Backend: **49 passed**, 106,63 detik, satu kali eksekusi penuh setelah perbaikan.
- Smoke test sesudah restart: `/health/ready`, `/login`, dan `/api/health/ready` HTTP 200.

## Pekerjaan tersisa

### Tambahan profil siswa dari client

- 14 tes terkait profil/migrasi, autentikasi, dan CRUD siswa lolos.
- Regresi penuh setelah fitur profil: **60 passed**, 104,48 detik.
- Pemeriksaan TypeScript setelah perubahan profil lolos.
- Halaman `/siswa/profil`, `/admin/siswa`, `/change-password` serta readiness
  database memberi HTTP 200 setelah perubahan. Ini pemeriksaan HTTP/kompilasi,
  belum pengujian interaksi browser.
- Kolom sekolah diterapkan pada database development setelah backup SQLite.
- Kebutuhan lain dan keputusan tertunda dicatat di
  [CLIENT_REQUESTS_2026-09-16.md](CLIENT_REQUESTS_2026-09-16.md).

### Tambahan bank soal dan subbab

- Regresi penuh: **64 passed**, 96,71 detik.
- Tes baru mencakup penyimpanan/detail/filter subbab, generator yang hanya
  mengambil soal approved, validasi bab/mapel, pengeditan draft/rejected,
  penolakan edit saat menunggu review, serta upgrade/downgrade migrasi.
- TypeScript setelah perubahan guru, admin, dan filter paket lolos.
- Build produksi frontend lolos setelah fitur profil dan subbab: 36 halaman
  statis dihasilkan, beserta route dinamis.
- Database lokal dicadangkan sebelum kolom dan indeks subbab ditambahkan.
- Pengelompokan visual dan modal edit belum diuji melalui interaksi browser.

### QA lanjutan yang masih diperlukan

- Uji browser: siswa mulai ujian, jawab, refresh, offline 2–3 menit, reconnect,
  submit, lalu verifikasi jawaban dan nilai. Sertakan gangguan jaringan ketika
  token kedaluwarsa.
- Uji responsif pada ponsel dan desktop, navigasi keyboard, editor rumus, serta
  paste contoh nyata dari Word/MathType.
- Uji beban 100+ siswa pada PostgreSQL dan lingkungan yang menyerupai server.
- Jalankan migrasi dari database PostgreSQL kosong dan dari snapshot versi lama.
  Migrasi constraint lama belum kompatibel dengan SQLite; database development
  saat ini dibuat dari metadata model, bukan bukti keberhasilan migrasi.
- UAT oleh admin, guru, dan siswa; keputusan branding oleh pemilik proyek.
- Siapkan server, domain, HTTPS, backup/restore, monitoring, serta soft launch.

Persentase lama pada dokumentasi bukan bukti bahwa semua alur sudah teruji.
