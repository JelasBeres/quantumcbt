# Perubahan kebutuhan client — 17 September 2026

Dokumen ini menjadi acuan terbaru jika bertentangan dengan roadmap lama atau catatan 16 September. Status di bawah menyatakan implementasi, bukan persetujuan UAT client.

## Konfirmasi pengguna

- Persetujuan soal hanya admin. Guru tidak dapat menyetujui soal sendiri maupun soal guru lain.
- Client belum memberikan ketentuan IRT dan perbedaan drill dengan latihan. Jangan menggunakan rumus tebakan atau menamai nilai biasa sebagai IRT.
- Pengguna mengonfirmasi bahwa yang dapat diulang adalah Latihan; Tryout sekali per jadwal dan langsung masuk ujian.

## Sudah tersedia dalam perubahan ini

- Guru dapat membuat revisi dari soal disetujui milik guru lain dalam cakupan mapel/kelas penugasannya. Revisi menjadi draft milik guru yang merevisi dan diajukan kepada admin.
- Tombol **Edit Soal (Revisi)** pada tab Disetujui langsung membuka draft revisi. Draft dan Perlu Revisi tetap mempunyai tombol Edit Soal. Soal sumber tetap tersedia tanpa mengubah isi ujian yang sudah menggunakan soal tersebut.
- Daftar soal API berurutan ID terbaru dahulu. Kelompok pada halaman guru mengikuti soal terbaru, dan isi tiap kelompok terbaru dahulu.
- Pemilihan otomatis mendukung **Campuran (jumlah per tingkat)** dengan jumlah mudah/sedang/sulit masing-masing, total 1–100. Filter mapel, kelas, bab, subbab dan pengecualian soal terpilih tetap berlaku. Kekurangan dilaporkan per tingkat tanpa substitusi tingkat lain.
- Hierarki mapel > bab > subbab sudah tersedia dari perubahan sebelumnya; subbab masih berupa teks pada soal, bukan tabel master tersendiri.
- Perbaikan timer: state API mengembalikan waktu UTC yang eksplisit. Browser menghitung dari sisa detik server menggunakan jam monotonik dan mengecek server sebelum otomatis mengumpulkan. Percobaan yang sudah selesai tidak dihapus atau dibuka ulang.

## Pekerjaan yang masih perlu diselesaikan

Pembaruan implementasi lanjutan:

- Speedtest dihapus dari seluruh pilihan aktif, schema create/update menolak tipenya, paket lama diarsipkan. Clone/unarchive tipe lama ditolak. Attempt/jawaban lama tidak dihapus.
- Filter pemilih manual: isi soal/ID/mapel, kelas, bab, subbab, kesulitan dan tipe; hanya soal approved yang dapat dipilih. Pemilih per bagian juga memiliki filter kesulitan. Bank soal admin/guru dan daftar jadwal mendapat tambahan filter.
- Latihan tersedia melalui `/siswa/latihan`, mulai tanpa jadwal melalui `/ujian-siswa/mulai-latihan`, melanjutkan sesi aktif atau membuat sesi baru setelah selesai. Program/kelas siswa tetap diperiksa. Riwayat hanya Tryout. Drill ditampilkan belum tersedia dan API menolaknya sampai spesifikasi ditetapkan.
- Klik Tryout aktif langsung memulai/melanjutkan ujian. Paket dengan bagian berurutan memiliki tombol Lanjut Mapel pada akhir bagian, tetap di halaman ujian. Backend mengunci soal bagian sebelum/sesudah bagian aktif. Timer saat ini adalah total durasi paket; belum ada perpindahan otomatis akibat timer per-mapel.
- Admin dapat mengisi maksimal tiga pasangan jurusan/universitas pada pembuatan/edit siswa. Siswa hanya dapat melihat pilihan tersebut; perubahan melalui API siswa ditolak.
- Penilaian biasa tetap aktif. IRT ditampilkan belum tersedia, tidak disimulasikan menggunakan nilai biasa.
- Migrasi lokal sudah dijalankan dengan backup `dev-local.before-client-17-20260917-151310.db`. Instalasi lain tetap perlu menjalankan migrasi normal.

- [ ] Pembuatan/pengelolaan paket dan jadwal hanya admin, termasuk penutupan akses API guru dan penyesuaian halaman guru.
- [ ] Penugasan guru oleh admin untuk pengisian paket. Penugasan mapel/kelas yang sudah ada belum merupakan penugasan per paket.
- [ ] Pemerataan filter/paginasi pada daftar lain di luar bank soal, pemilih manual, paket, jadwal dan Latihan.
- [x] Alur TO UTBK langsung mulai dan berlanjut antar-mapel dalam halaman ujian, termasuk validasi perpindahan bagian di server.
- [x] Latihan tanpa jadwal, bisa diulang kapan pun, dan tidak masuk riwayat Tryout. Mode drill masih terpisah di pekerjaan menunggu spesifikasi.
- [x] Menghapus Speedtest dari alur aktif tanpa menghilangkan data historis secara sembarangan.
- [x] Pilihan jurusan/universitas diisi admin saat membuat akun siswa; bukan pilihan yang diedit siswa sendiri.
- [ ] Pilihan penilaian biasa/IRT setelah spesifikasi IRT tersedia. Perlu ketentuan model, parameter/kalibrasi dan pemetaan skor.
- [ ] Definisi drill: batas waktu, kapan kunci/pembahasan muncul, serta perilaku pengulangan.

## Pemeriksaan browser

1. Guru → Kelola Soal → Disetujui: soal guru lain dalam penugasan terlihat; Edit Soal (Revisi) membuka draft. Ubah, simpan, ajukan; admin yang menyetujui.
2. Admin → paket → pemilihan otomatis → Campuran: isi 5/3/2, generate, cocokkan jumlah tiap tingkat. Coba jumlah melebihi stok dan periksa pesan kekurangan.
3. Mulai sesi ujian baru: timer sesuai durasi dan tidak langsung selesai. Muat ulang halaman lalu lanjutkan; timer tidak kembali penuh. Perubahan ini tidak mereset sesi lama yang sudah terkumpul.
4. Siswa → Latihan: mulai tanpa jadwal, kumpulkan, lalu mulai lagi. Kedua sesi tidak muncul di Riwayat. Sesi aktif yang belum selesai dilanjutkan.
5. Tryout yang memiliki dua bagian: mulai langsung, selesaikan mapel pertama → Lanjut Mapel; tetap di halaman ujian. Refresh tetap berada di mapel aktif. Mapel sebelumnya tidak dapat dibuka kembali.
6. Admin → Siswa: isi jurusan dan universitas, simpan, lalu periksa profil siswa. Pasangan pilihan hanya dapat diubah admin.

Pemeriksaan browser interaktif dan UAT client masih diperlukan.
