*PROGRESS REVISI QUANTUM CBT*
Update: 04 Oktober 2026

Keterangan status:
[Online] = sudah bisa dicoba di quantum-test.jbackup.my.id
[Selesai] = sudah dikerjakan dan dites, belum di-upload ke server
[Konfirmasi] = menunggu jawaban client

*A. Persiapan Produksi (Terbaru)*
[Selesai] Database server sudah di-wipe (dibersihkan) bersih dari data testing/dummy. Hanya menyisakan akun inti (Admin, Siswa, Guru) agar siap digunakan di produksi/VPS.
[Selesai] Source code bersih dalam format .zip (tanpa cache/node_modules) sudah digenerate.
[Selesai] Editor soal (Tiptap) sudah diperbarui, bug tombol superskrip (x2), subskrip, hapus format, dan opsi kosong lolos sudah dibereskan secara tuntas.
[Selesai] Validasi "isian singkat" sudah diwajibkan untuk diisi pada frontend saat pembuatan soal.

*B. Ruang ujian siswa*
[Online] Popup sebelum lanjut/kumpulkan menampilkan nomor soal yang belum dijawab dan ragu-ragu (tombol "Kembali Mengerjakan" / "Tetap Lanjut")
[Online] Warna nomor soal: oranye = sedang dikerjakan, biru tua = terjawab, kuning = ragu-ragu, garis merah = dibuka tapi belum diisi, putih = belum dikerjakan
[Online] Soal Benar/Salah dengan beberapa pernyataan baru dihitung terjawab jika semua pernyataan sudah diisi
[Online] Nomor soal di laptop diperkecil agar area soal lebih luas
[Online] Mode drilling: tombol "Kumpulkan" jadi "Selesai" dan tidak masuk riwayat

*C. Halaman siswa*
[Online] Menu "Ujian Aktif" dihapus
[Online] Kartu kategori Try Out/Latihan dipercantik: satu kartu per baris, berwarna dan berikon; kategori yang tersedia tampil paling atas, yang belum ada paketnya abu-abu dengan gembok
[Online] Tombol "Lihat Mapel" diganti "Kerjakan Set Soal"

*D. Bank soal & editor*
[Online] Editor soal: tombol rata kanan-kiri (justify)
[Online] Lebar kolom tabel di editor bisa digeser
[Online] Default soal baru: tingkat kesulitan sedang, poin 2 (soal lama berpoin 1 sudah disamakan jadi 2)
[Online] Isi Soal > Pilih Manual: filter satu baris (Bab, Sub Bab, Tingkat Kesulitan, Pembuat Soal, Tgl dibuat, Sampai Tgl, Reset) + pilihan tipe soal diawali "Semua"
[Online] Isi Soal > Auto-Generate: urutan Kelas Paket, Mapel, Bab, Sub Bab, Tipe Soal, Tingkat Kesulitan
[Konfirmasi] Tipe Soal "Campuran" di Auto-Generate saat ini mengambil soal acak dari semua tipe. Apakah perlu bisa diatur jumlah per tipe (misal 5 PG, 3 Benar/Salah)?

*E. Unduh soal*
[Online] Tombol "Unduh Soal" di setiap kartu set soal (admin dan guru pengampu)
[Online] Tampilan sesuai contoh: tab Naskah soal / Kunci & pembahasan, kop logo Quantum Research, watermark, nomor halaman, tombol Unduh PDF
[Konfirmasi] Unduhan saat ini per set soal. Apakah perlu juga unduh satu paket utuh (semua set sekaligus)?

*F. Admin*
[Online] Dashboard: kartu "Tindakan yang Perlu Diperhatikan" berisi pengajuan soal, set soal, dan jadwal dari guru; bisa diklik langsung ke halamannya
[Online] Menu "Analisis Soal" diganti "Laporan Soal"
[Online] Rekap Nilai: tombol Reset pengerjaan siswa di samping kolom Waktu (siswa bisa mengerjakan ulang selama jadwal masih berlangsung)

*G. Penilaian*
[Online] KKM bisa diatur per paket (default 75); status Lulus/Belum lulus di Rekap Nilai dan Excel mengikuti KKM paket masing-masing
[Online] Paket Benchmark Kohort (skala 0-1000) tidak memakai status lulus/tidak lulus
[Konfirmasi] Posisi input KKM saat ini di form Buat/Edit Paket, di sebelah Metode Penilaian. Apakah sudah sesuai?
[Online] Penjelasan poin vs tingkat kesulitan sudah dijawab (tingkat kesulitan untuk filter, poin untuk perhitungan nilai)

*Status*
Persiapan produksi telah rampung, database dibersihkan dan siap dirilis. Zip telah dibuat.
