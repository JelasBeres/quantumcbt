*PROGRESS REVISI QUANTUM CBT*
Update: 04 Oktober 2026

Keterangan status:
[Selesai] = fitur sudah rampung dan siap digunakan di production
[Konfirmasi] = menunggu jawaban client

*A. Persiapan Produksi (Terbaru)*
[Selesai] Database server sudah di-wipe (dibersihkan) bersih dari data testing/dummy. Hanya menyisakan akun inti (Admin, Siswa, Guru) agar siap digunakan di produksi/VPS.
[Selesai] Source code bersih dalam format .zip (tanpa cache/node_modules) sudah digenerate.
[Selesai] Editor soal (Tiptap) sudah diperbarui, bug tombol superskrip (x2), subskrip, hapus format, dan opsi kosong lolos sudah dibereskan secara tuntas.
[Selesai] Validasi "isian singkat" sudah diwajibkan untuk diisi pada frontend saat pembuatan soal.

*B. Ruang ujian siswa*
[Selesai] Popup sebelum lanjut/kumpulkan menampilkan nomor soal yang belum dijawab dan ragu-ragu (tombol "Kembali Mengerjakan" / "Tetap Lanjut")
[Selesai] Warna nomor soal: oranye = sedang dikerjakan, biru tua = terjawab, kuning = ragu-ragu, garis merah = dibuka tapi belum diisi, putih = belum dikerjakan
[Selesai] Soal Benar/Salah dengan beberapa pernyataan baru dihitung terjawab jika semua pernyataan sudah diisi
[Selesai] Nomor soal di laptop diperkecil agar area soal lebih luas
[Selesai] Mode drilling: tombol "Kumpulkan" jadi "Selesai" dan tidak masuk riwayat

*C. Halaman siswa*
[Selesai] Menu "Ujian Aktif" dihapus
[Selesai] Kartu kategori Try Out/Latihan dipercantik: satu kartu per baris, berwarna dan berikon; kategori yang tersedia tampil paling atas, yang belum ada paketnya abu-abu dengan gembok
[Selesai] Tombol "Lihat Mapel" diganti "Kerjakan Set Soal"

*D. Bank soal & editor*
[Selesai] Editor soal: tombol rata kanan-kiri (justify)
[Selesai] Lebar kolom tabel di editor bisa digeser
[Selesai] Default soal baru: tingkat kesulitan sedang, poin 2 (soal lama berpoin 1 sudah disamakan jadi 2)
[Selesai] Isi Soal > Pilih Manual: filter satu baris (Bab, Sub Bab, Tingkat Kesulitan, Pembuat Soal, Tgl dibuat, Sampai Tgl, Reset) + pilihan tipe soal diawali "Semua"
[Selesai] Isi Soal > Auto-Generate: urutan Kelas Paket, Mapel, Bab, Sub Bab, Tipe Soal, Tingkat Kesulitan
[Konfirmasi] Tipe Soal "Campuran" di Auto-Generate saat ini mengambil soal acak dari semua tipe. Apakah perlu bisa diatur jumlah per tipe (misal 5 PG, 3 Benar/Salah)?

*E. Unduh soal*
[Selesai] Tombol "Unduh Soal" di setiap kartu set soal (admin dan guru pengampu)
[Selesai] Tampilan sesuai contoh: tab Naskah soal / Kunci & pembahasan, kop logo Quantum Research, watermark, nomor halaman, tombol Unduh PDF
[Konfirmasi] Unduhan saat ini per set soal. Apakah perlu juga unduh satu paket utuh (semua set sekaligus)?

*F. Admin*
[Selesai] Dashboard: kartu "Tindakan yang Perlu Diperhatikan" berisi pengajuan soal, set soal, dan jadwal dari guru; bisa diklik langsung ke halamannya
[Selesai] Menu "Analisis Soal" diganti "Laporan Soal"
[Selesai] Rekap Nilai: tombol Reset pengerjaan siswa di samping kolom Waktu (siswa bisa mengerjakan ulang selama jadwal masih berlangsung)

*G. Penilaian*
[Selesai] KKM bisa diatur per paket (default 75); status Lulus/Belum lulus di Rekap Nilai dan Excel mengikuti KKM paket masing-masing
[Selesai] Paket Benchmark Kohort (skala 0-1000) tidak memakai status lulus/tidak lulus
[Konfirmasi] Posisi input KKM saat ini di form Buat/Edit Paket, di sebelah Metode Penilaian. Apakah sudah sesuai?
[Selesai] Penjelasan poin vs tingkat kesulitan sudah dijawab (tingkat kesulitan untuk filter, poin untuk perhitungan nilai)

*Status*
Persiapan produksi telah rampung, database dibersihkan dan siap dirilis. Zip telah dibuat.
