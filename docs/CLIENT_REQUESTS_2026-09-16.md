# Revisi client — 16 September 2026

Sumber: tiga foto catatan client yang dibagikan dalam percakapan. Ini merupakan
ringkasan kebutuhan; keputusan yang belum jelas tetap menunggu konfirmasi.

## Sudah diimplementasikan: profil siswa

- [x] Kolom sekolah opsional pada profil siswa.
- [x] Halaman `/siswa/profil` untuk mengubah nama lengkap dan sekolah sendiri.
- [x] Menu Profil pada navigasi siswa desktop dan ponsel.
- [x] Kolom sekolah pada tabel serta form tambah/edit siswa oleh admin.
- [x] Akses ganti password dari profil; validasi sesuai backend, pesan kesalahan
  yang dapat dibaca, serta arahan masuk kembali setelah password berubah.
- [x] API profil membatasi perubahan ke nama dan sekolah; menolak user ID,
  nomor induk, program, dan kelas yang disisipkan dalam payload.
- [x] Migrasi penambahan sekolah beserta tes upgrade/downgrade yang mempertahankan data.

Sekolah belum diwajibkan karena catatan client hanya meminta penambahan kolom.
Nama kosong/lebih dari 200 karakter dan sekolah lebih dari 200 karakter ditolak
oleh API profil. Sekolah kosong disimpan sebagai null.

Database development sudah dicadangkan sebelum penambahan kolom. Karena
database tersebut sebelumnya dibuat dari metadata model, migrasi sekolah
diterapkan tersendiri tanpa melakukan stamp atas migrasi lama yang belum lolos.
Pada database dengan riwayat Alembic yang sesuai, gunakan `alembic upgrade head`.
Migrasi PostgreSQL menyeluruh tetap merupakan pekerjaan QA terpisah.

## Sudah diimplementasikan: bank soal guru dan subbab

- [x] Subbab opsional pada soal, maksimal 150 karakter, ditulis di bawah bab yang dipilih.
- [x] Validasi bahwa bab sesuai mapel; subbab tidak boleh diisi tanpa bab.
- [x] Halaman Soal Saya dikelompokkan menurut kombinasi kelas / mapel / bab / subbab,
  dengan filter berurutan dan kelompok khusus untuk metadata yang belum diisi.
- [x] Tombol Edit Soal untuk draft dan soal perlu revisi; form memuat isi serta
  kunci opsi yang tersimpan. Setelah perbaikan soal rejected kembali menjadi draft.
- [x] Metadata subbab pada form dan tabel soal admin.
- [x] Filter subbab pada kandidat otomatis dan pemilihan soal per bagian paket.
- [x] Subbab disertakan pada detail soal, detail paket, dan salinan revisi yang sudah ada.
- [x] Migrasi subbab beserta tes upgrade/downgrade yang mempertahankan soal lama.

Subbab saat ini berupa nama teks per soal, bukan master data terpisah. Filter
mengambil nama subbab yang sudah digunakan. Penggunaan spasi tepi dinormalisasi;
nama harus konsisten agar masuk kelompok yang sama. Perubahan bab mengosongkan
subbab pada form. Klien lama yang mengedit dalam bab yang sama tetap mempertahankan
subbab bila field tersebut tidak dikirim.

Perilaku revisi soal approved yang sudah ada dipertahankan sambil menunggu jawaban
client; belum dianggap sebagai keputusan final atas alur revisi tersebut.

Verifikasi backend setelah tahap ini: **64 tes lolos** dalam satu suite.

## Kebutuhan jelas yang belum dikerjakan pada tahap ini

- Tampilan benar/salah berupa tabel pernyataan dengan label pilihan yang bisa diubah.
- Uji interaksi browser untuk edit draft/revisi, ajukan review, dan tarik pengajuan.
- Penggunaan istilah Tryout serta penataan tombol pembuatan paket.
- Halaman khusus isi soal/atur bagian; melengkapi indeks manual menurut mapel,
  kesulitan, bab/subbab, dan waktu input.

## Menunggu jawaban client

1. Revisi soal approved: mengubah asli atau membuat versi baru?
2. Campuran kesulitan otomatis: jumlah, persentase, atau acak?
3. Speedtest: hanya hilang dari pilihan baru atau juga mengubah paket lama?
4. Jurusan/universitas: teks bebas atau daftar; apakah ketiga pilihan wajib?

Pilihan jurusan/universitas belum dibuat agar format datanya mengikuti jawaban client.
