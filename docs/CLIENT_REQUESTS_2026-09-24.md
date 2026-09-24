# Revisi client — 24 September 2026

Dokumen ini menggantikan aturan 17 September yang bertentangan.

## Revisi soal approved

- Guru dapat membuat revisi dari soal approved **milik sendiri maupun milik guru lain** dalam cakupan mapel/kelas penugasannya (sebelumnya hanya soal guru lain).
- Revisi selalu berupa draft baru milik guru yang merevisi, diajukan ke admin, dan hanya admin yang dapat menyetujuinya. Guru tidak dapat menyetujui soal apa pun, termasuk soal atau revisinya sendiri.
- Soal sumber tetap approved dan dipakai sampai revisi disetujui. Revisi yang di-ACC mengganti relasi soal hanya pada paket yang belum dimulai (aturan 18 September tetap berlaku).
- Tombol **Edit Soal (Revisi)** tampil pada semua soal approved di Kelola Soal guru dan di Laporan Soal.

## Warna hasil mode drilling

- Setelah **Konfirmasi Jawaban** pada mode drilling tidak ada kotak/pop-up hasil. Opsi A/B/C yang benar berwarna **hijau** dan pilihan siswa yang salah **merah** (tabel benar/salah per pernyataan, isian/esai lewat warna kolom jawaban). Pembahasan tetap tampil di bawah jawaban.
- Nomor bulat di atas: **hijau** benar, **merah** salah, **kuning** ragu-ragu, biru terjawab (belum dikonfirmasi).
- Jawaban yang sudah dikonfirmasi terkunci dan warnanya tetap tampil setelah halaman dimuat ulang (kolom `jawaban_siswa.dikonfirmasi_at`).
- Halaman hasil/pembahasan memakai skema yang sama: benar hijau (sebelumnya biru).
- Mode tryout tidak berubah: benar/salah baru terlihat di halaman hasil.

## Riwayat bertingkat

- Riwayat mengikuti menu Tryout: **Riwayat → Kategori (UTBK) → Tryout (UTBK 1) → Mapel (PU, dst.) → Pembahasan mapel itu**.
- Halaman mapel menampilkan set soal per mapel beserta jumlah benar/salah/kosong; tombol **Lihat Pembahasan** membuka pembahasan yang hanya berisi soal mapel tersebut, tersedia juga pembahasan semua mapel.

## Esai belum dinilai

- Esai yang belum dikoreksi guru **sementara dihitung 0** (salah), termasuk pada paket Benchmark Kohort. Sebelumnya nilai kohort kosong ("Belum tersedia") sampai semua esai dikoreksi.
- Nilai tetap berlabel **Sementara** selama masih ada esai yang belum dinilai, dan otomatis dihitung ulang saat guru mengoreksi.

## Pemberitahuan siswa

- Menu **Pemberitahuan** di navigasi siswa (desktop) dan ikon lonceng di header (HP), dengan badge jumlah belum dibaca. Halaman daftar punya filter Semua/Belum dibaca dan tombol tandai semua dibaca.
- **Popup** saat siswa membuka aplikasi untuk pemberitahuan baru yang ditandai popup (maks. 5 antre, satu per satu). Ditutup/dilihat = ditandai dibaca, jadi tidak muncul lagi. Popup tidak tampil di ruang ujian.
- Admin mengelola di **Sistem → Pemberitahuan Siswa**: judul, isi, jenis (Promo/Info/Paket Baru), tautan opsional (`/siswa/...` atau `https://`), target program/kelas, batas tayang, opsi popup, aktif/nonaktif, dan jumlah siswa yang sudah membaca.
- **Otomatis**: saat jadwal tryout dipublikasikan (publish langsung atau ACC review) dibuat pemberitahuan "Paket ujian baru: …" untuk program/kelas jadwal itu, bertautan ke halaman paket dan tayang sampai jadwal selesai. Jadwal ditarik/ditolak/dihapus → pemberitahuan disembunyikan; publikasi ulang tidak membuat duplikat.
