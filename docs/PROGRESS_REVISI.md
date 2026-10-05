*PROGRESS REVISI QUANTUM CBT*
Update: 05 Oktober 2026

Keterangan status:
[Selesai] = sudah dikerjakan dan dites
[Belum] = belum dijalankan, menunggu persetujuan
[Konfirmasi] = menunggu jawaban client

*A. Persiapan serah terima (terbaru)*
[Selesai] Source code bersih dalam format .zip: hanya kode, tanpa file konfigurasi rahasia, database, maupun log
[Selesai] Dokumentasi diperbarui: cara instalasi dari nol, membuat akun admin, deploy, dan catatan revisi lengkap
[Selesai] Script pembersih data server sudah diperbaiki dan dites (versi sebelumnya gagal sehingga tidak ada data yang terhapus)
[Belum] Pembersihan data uji coba di server. Data saat ini masih berisi paket, soal, dan pengerjaan uji coba. Akun, program, kelas, dan mapel tetap dipertahankan
[Selesai] Nilai try out kini benar-benar ditahan sampai jadwal berakhir di semua halaman siswa (sebelumnya masih terlihat di dashboard)

*B. Try Out TKA & penilaian*
[Selesai] Mapel wajib dan mapel pilihan pada Try Out TKA, siswa memilih mapel sebelum mulai (minimal/maksimal diatur per paket)
[Selesai] Siswa hanya mengerjakan soal dari mapel yang dipilih; waktu pengerjaan mengikuti mapel yang dikerjakan
[Selesai] Nilai kohort TKA diperbaiki (nilai sempurna 800)
[Selesai] Kunci, pembahasan, dan nilai try out ditahan sampai semua jadwal paket berakhir
[Selesai] Rata-rata nilai dipisah per skala: nilai biasa, TKA, dan UTBK
[Selesai] Esai yang tidak dijawab bernilai 0 dan tidak menunggu koreksi

*C. Jadwal & rekap nilai*
[Selesai] Jadwal yang sudah dikerjakan siswa hanya bisa diubah waktu selesainya
[Selesai] Guru hanya melihat rekap nilai mapel yang diampu; latihan per mapel dan drilling tidak masuk rekap

*D. Bank soal & editor*
[Selesai] Editor soal baru (superskrip, subskrip, rata kanan-kiri, tabel, gambar, rumus)
[Selesai] Soal yang belum lengkap tidak bisa diajukan/disetujui; isian wajib punya kunci; opsi kosong tidak disimpan
[Selesai] Default soal baru: tingkat kesulitan sedang, poin 2
[Selesai] Isi Soal > Pilih Manual dan Auto-Generate sesuai sketsa client
[Konfirmasi] Tipe Soal "Campuran" di Auto-Generate saat ini mengambil soal acak dari semua tipe. Apakah perlu bisa diatur jumlah per tipe (misal 5 PG, 3 Benar/Salah)?

*E. Ruang ujian & halaman siswa*
[Selesai] Popup sebelum lanjut/kumpulkan menampilkan nomor soal yang belum dijawab dan ragu-ragu
[Selesai] Warna nomor soal: oranye = sedang dikerjakan, biru tua = terjawab, kuning = ragu-ragu, garis merah = dibuka tapi belum diisi, putih = belum dikerjakan
[Selesai] Mode drilling: tombol "Selesai" dan tidak masuk riwayat
[Selesai] Pesan error dan login dalam bahasa Indonesia; setelah sesi habis kembali ke halaman semula
[Selesai] Kartu kategori Try Out/Latihan dipercantik; tombol "Kerjakan Set Soal"

*F. Unduh soal & admin*
[Selesai] Tombol "Unduh Soal" per set soal: naskah, kunci & pembahasan, kop Quantum Research, watermark, Unduh PDF
[Selesai] Dashboard admin: "Tindakan yang Perlu Diperhatikan"; menu "Laporan Soal"; Reset pengerjaan siswa di Rekap Nilai
[Selesai] KKM per paket (default 75); paket Benchmark Kohort tanpa status lulus
[Konfirmasi] Unduhan saat ini per set soal. Apakah perlu juga unduh satu paket utuh (semua set sekaligus)?
[Konfirmasi] Posisi input KKM saat ini di form Buat/Edit Paket, di sebelah Metode Penilaian. Apakah sudah sesuai?

*Status*
Semua fitur selesai dan dites. Tinggal pembersihan data uji coba di server (menunggu persetujuan) dan tiga pertanyaan konfirmasi di atas.
