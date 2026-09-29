# Data dummy lokal

Dataset dibuat melalui `backend/scripts/seed_local_demo.py` khusus untuk database
`backend/dev-local.db`. Script mencadangkan database sebelum menambah data dan
menyimpan penanda `local_demo_dataset_v1` agar pemanggilan ulang tidak menggandakan
data. Akun, password, dan data yang sudah ada tidak ditimpa.

## Isi

- 37 soal milik `guru.demo`: 28 approved, 3 draft, 3 pending review, 3 rejected.
- Matematika/Fisika, kelas 11/12, bab dan subbab, tiga tingkat kesulitan.
- Pilihan ganda, pilihan lebih dari satu, benar/salah, isian, dan esai.
- 8 akun tambahan `siswa.dummy01` sampai `siswa.dummy08` dengan profil sekolah.
- 4 paket beserta bagian, relasi soal, dan jadwal.
- 9 riwayat ujian dengan jawaban dan nilai yang dihitung oleh fungsi scoring aplikasi.
- 5 jawaban esai menunggu koreksi.

## Mulai mencoba

- `siswa.demo`: pilih **Latihan Dummy - Siap Dikerjakan**. Jadwal berlaku dari satu
  jam sebelum seeding sampai tujuh hari setelah seeding. Waktu pengerjaan 45 menit.
- **Tryout Dummy - Besok** dimulai satu hari setelah seeding.
- **Tryout Dummy - Riwayat Nilai** sudah selesai; buka Riwayat/Hasil atau Rekap Nilai.
- Admin: review **Tryout Dummy - Menunggu Review**, review soal, dan koreksi esai.
- Guru: filter Soal Saya, edit draft/perlu revisi, ajukan dan tarik pengajuan.

Jadwal tidak digeser otomatis saat script dijalankan ulang; ubah lewat admin
jika masa jadwal sudah lewat. Dataset bukan klaim hasil pengujian beban.

## Verifikasi

Pemeriksaan foreign key SQLite lolos. API daftar soal, siswa, paket, jadwal,
statistik, analitik hasil, koreksi esai, scope guru, dashboard siswa, jadwal
tersedia, serta riwayat siswa berhasil merespons HTTP 200 setelah seeding.
Pemanggilan ulang script dikonfirmasi tidak menambah data lagi.
