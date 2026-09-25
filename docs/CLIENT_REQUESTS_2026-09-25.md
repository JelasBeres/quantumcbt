# Revisi client — 25 September 2026

Dokumen ini menggantikan aturan 24 September yang bertentangan (bagian "Revisi soal approved").

## Tombol Buat Paket

- Di menu **Ujian → Try Out → Kategori**, tombol **Buat Try Out** diganti menjadi **Buat Paket**, begitu juga judul halaman formnya. Tombol **Buat Latihan** tidak berubah.

## Admin mengisi soal langsung di paket

- Pada kartu bagian/set soal (Try Out maupun set Latihan), admin kini punya tombol **Isi Soal** (halaman yang sama dengan guru: pilih manual atau auto-generate dari bank soal) dan **Atur Durasi**.
- Admin dapat memilih semua soal approved yang sesuai mapel dan kelas bagian, tanpa batas penugasan guru.
- Bagian yang diisi admin **langsung disetujui** tanpa review, begitu soal dan durasinya lengkap. Jika belum lengkap, statusnya tetap draft.
- Guru pengampu tetap dapat mengisi bagian seperti sebelumnya. Perubahan oleh guru tetap membatalkan persetujuan dan harus diajukan review lagi.

## Pilihan jawaban default A–E

- Form soal pilihan ganda dan pilihan lebih dari satu kini dibuka dengan **5 pilihan (A–E)**. Pilihan yang dibiarkan kosong tidak disimpan.

## Pratinjau soal di hierarki

- Di Bank Soal admin (tombol **Lihat**) dan Kelola Soal guru (tombol **Lihat Soal**), soal dapat dibuka dalam satu tampilan utuh: teks/gambar soal, pilihan jawaban dengan kunci ditandai hijau (tabel pernyataan untuk benar/salah, kunci untuk isian/esai), dan pembahasan. Ada tombol **Edit Soal** dari tampilan itu.

## Edit soal approved tanpa review ulang

- Guru pengampu (soal milik sendiri maupun guru lain dalam mapel/kelas penugasannya) mengedit soal approved **langsung pada soal yang sama**. Tidak ada soal/revisi baru, status tetap approved, dan tidak perlu diajukan review. Riwayat soal mencatat aksi `edited`.
- Pengecualian: soal yang **sudah dijawab siswa** tidak dapat diedit, agar nilai yang tersimpan dan pembahasan di riwayat siswa tetap cocok. Buat soal baru untuk mengganti soal tersebut.
- Soal approved tidak dapat diajukan review ulang dan tidak dapat dihapus guru.
- Tombol **Edit Soal (Revisi)** di Kelola Soal dan Laporan Soal diganti menjadi **Edit Soal** biasa. Draft revisi lama (dibuat sebelum aturan ini) tetap mengikuti alur review seperti biasa.

## Pertanyaan client: ID soal untuk apa?

ID soal (mis. `#123`) adalah nomor unik tiap soal di bank soal. Nomor ini tidak berubah walaupun soal diedit. Kegunaannya:

- **Mencari soal dengan cepat**: kolom "Cari isi soal / ID" di Bank Soal, Kelola Soal, dan halaman Isi Soal paket.
- **Rujukan saat melapor**: Laporan Soal menyebut "Soal #123", sehingga admin dan guru langsung tahu soal mana yang bermasalah walaupun teksnya mirip.
- **Membedakan soal kembar**: dua soal dengan teks sama (mis. duplikat) tetap bisa dibedakan.
- **Penghubung data**: sistem memakai ID ini untuk mengaitkan soal dengan paket, jawaban siswa, dan riwayat review.
