# Persiapan serah terima — 4–5 Oktober 2026

## Permintaan

1. Membersihkan data di VPS, kecuali akun (admin, guru, siswa) dan data master.
2. Memperbarui dokumentasi.
3. Menyiapkan source code bersih dalam bentuk .zip.

## Status

| Hal | Status |
|---|---|
| Script pembersih data | Siap (`backend/scripts/clear_vps_data.py`), **belum dijalankan di VPS** |
| Zip source code | Siap (`python make_zip.py`), berisi file yang di-commit saja |
| Dokumentasi | Diperbarui 5 Oktober 2026 |

Per 5 Oktober 2026 database VPS masih berisi data uji coba (25 paket, 32 soal,
58 jadwal, 67 pengerjaan). Script versi 4 Oktober gagal di tengah jalan (lihat di
bawah) dan belum pernah ikut ter-deploy, jadi pembersihan memang belum terjadi.

## Membersihkan data di VPS

Yang dihapus: paket, set soal, jadwal, bank soal (beserta opsi/pernyataan), bab &
subbab, pengerjaan siswa, jawaban, hasil, log kecurangan, laporan soal,
pemberitahuan, riwayat login, dan sesi login (semua pengguna harus login ulang).

Yang dipertahankan: `users`, `siswa`, `guru`, penugasan guru, `program`, `kelas`,
`pelajaran`, dan pengaturan. Kategori paket bawaan (UTBK, TKA SMA, TKA SMP) dibuat
ulang otomatis saat menu kategori pertama kali dibuka. File gambar di
`backend/uploads` tidak ikut dihapus.

Langkah (setelah kode terbaru di-deploy):

```bash
# 1. backup dulu
ssh -i ~/.ssh/quantumcbt_vps_key root@202.155.13.133 'D=/opt/quantumcbt/backups/pre-clear-$(date +%Y%m%d-%H%M%S); mkdir -p $D && sudo -u postgres pg_dump -Fc quantumcbt > $D/quantumcbt.dump && echo $D'
# 2. bersihkan (menjawab prompt y/n)
ssh -t -i ~/.ssh/quantumcbt_vps_key root@202.155.13.133 'cd /opt/quantumcbt/backend && sudo -u quantumcbt bash -c "set -a; . ./.env; venv/bin/python scripts/clear_vps_data.py"'
```

Semua penghapusan berjalan dalam satu transaksi: kalau ada yang gagal, tidak ada
data yang terhapus.

## Perbaikan 5 Oktober (pemeriksaan sebelum serah terima)

- **Script pembersih gagal total.** `kategori_paket` dihapus sebelum `paket_ujian`,
  padahal relasinya `ON DELETE RESTRICT`, sehingga seluruh transaksi dibatalkan.
  Urutan diperbaiki dan diuji pada salinan database berisi data.
- **Zip berisi rahasia dan data.** `make_zip.py` versi lama ikut memaketkan
  `backend/.env`, `frontend/.env.local`, semua file `*.db` (termasuk backup berisi
  data uji coba), log, dan file pribadi. Sekarang zip dibuat dengan `git archive`
  dari commit HEAD dan dibatalkan bila menemukan file sensitif. `*.zip` masuk
  `.gitignore` agar tidak ikut terkirim oleh `deploy.sh`. Zip lama sudah dihapus.
  `.env` yang sempat ikut adalah konfigurasi lokal (SQLite), bukan kredensial VPS.
- **Nilai try out bocor walau "ditahan".** Sebelumnya hanya halaman hasil yang
  menyembunyikan nilai, sedangkan dashboard siswa ("Nilai Terakhir", rata-rata) dan
  API tetap mengirimkannya. Sekarang server mengosongkan nilai, skor mentah, dan
  rincian per mapel untuk siswa di semua endpoint (`/hasil-ujian/...`,
  `/siswa/riwayat-ujian`, `/siswa/riwayat-latihan`, `/siswa/dashboard`) selama
  jadwal try out paket itu belum berakhir. Riwayat try out membawa `nilai_ditahan`.
- **Setup lokal dari nol gagal.** Rantai migrasi lama memakai SQL khusus
  PostgreSQL sehingga `alembic upgrade head` gagal pada SQLite baru, dan tidak ada
  cara membuat admin pertama. Ditambah `scripts/init_db.py` dan
  `scripts/create_admin.py` (lihat README).
- **Script lama dibersihkan.** `clean_db.py` (menghapus kelas/program/pelajaran
  sehingga relasi siswa & guru rusak) dan script perbaikan data sekali-jalan di
  `backend/scripts` (sebagian sudah tidak bisa dijalankan karena memakai model yang
  sudah dihapus) dikeluarkan dari repo; masih ada di riwayat git.
