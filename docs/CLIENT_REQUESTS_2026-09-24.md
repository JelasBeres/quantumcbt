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
