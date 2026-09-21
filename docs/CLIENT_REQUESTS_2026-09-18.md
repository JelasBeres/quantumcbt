# Kebutuhan client dan implementasi — 18 September 2026

Dokumen ini menggantikan aturan 17 September yang bertentangan. Persetujuan soal tetap hanya admin. Penilaian biasa digunakan sekarang; lampiran client adalah spesifikasi **skor kohort**, bukan IRT, dan disimpan untuk tahap berikutnya.

## Implementasi

- Latihan menyediakan Mode Ujian (timer total, hasil/pembahasan setelah selesai) dan Mode Drilling (tanpa timer, konfirmasi jawaban per soal untuk membuka kunci/pembahasan).
- Drilling tidak kedaluwarsa karena durasi paket. State mengembalikan `mode_latihan=drill`, `sisa_waktu_detik=-1`, dan deadline null. Frontend tidak menjalankan countdown/submit otomatis untuk drilling.
- API konfirmasi memeriksa kepemilikan sesi, mode, keanggotaan soal dan keberadaan jawaban. Mode Ujian/Tryout tidak dapat memakai endpoint ini untuk membuka kunci. Esai tanpa penilaian otomatis meminta siswa membandingkan jawaban dengan pembahasan, bukan memberikan keputusan benar/salah palsu.
- Sesi latihan aktif dilanjutkan per mode; sesi mode ujian dan drilling tidak tertukar. Latihan tetap tidak masuk riwayat Tryout.
- UTBK menggunakan satu timer total. Navigasi Berikutnya pada soal terakhir mapel langsung membuka soal pertama mapel berikutnya, tanpa dialog penguncian atau keluar halaman. Semua mapel dapat dikunjungi kembali. Timer tidak direset saat berpindah.
- Admin membuat/mengatur paket dan jadwal. Pembuatan/ubah/hapus/clone/arsip paket serta pembuatan/ubah jadwal oleh guru ditolak API. Halaman jadwal guru dialihkan ke paket penugasan.
- Admin memakai tombol **Tugaskan Guru** pada paket. Guru harus aktif dan memiliki penugasan akademik yang sesuai. Tidak ada tenggat pengisian soal.
- Guru hanya melihat/mengisi paket yang ditugaskan. Guru dapat mengatur durasi total siswa melalui **Atur Durasi**. Jumlah soal mengikuti soal yang dipilih, tanpa kuota penugasan. Paket dengan bagian mapel diisi melalui bagian; pemeriksaan scope mencegah pengisian bagian mapel guru lain.
- Revisi soal yang di-ACC otomatis mengganti relasi soal pada paket belum dimulai. Paket arsip, paket dengan attempt, dan paket dengan jadwal publik yang sudah mulai tidak diubah. Urutan dan bagian relasi dipertahankan; soal sumber/jawaban lama tidak dihapus.
- Filter pembuat soal dan tanggal pembuatan tersedia di bank soal admin/guru dan pemilih manual paket. Daftar jadwal memiliki rentang tanggal mulai, selain filter yang sudah ada.

## Migrasi lokal

Kolom JSON `paket_ujian.assigned_guru_ids` ditambahkan lewat migrasi `l2a3b4c5d6e7`. Database lokal dibackup sebelum migrasi. Paket lama tidak otomatis dianggap ditugaskan; admin memilih guru melalui UI. PostgreSQL/instalasi lain memakai rantai Alembic normal, bukan script SQLite lokal.

## Uji browser

1. Admin → Paket → Tugaskan Guru → pilih guru pengampu → simpan. Login guru: paket tersebut terlihat, paket lain tidak; guru tidak melihat tombol pembuatan paket/jadwal.
2. Guru → Isi Soal atau Atur Bagian → Isi Soal, sesuai mapel. Atur Durasi berlaku sebelum paket memiliki pengerjaan.
3. Siswa → Latihan → Mode Drilling. Tidak ada countdown. Pilih jawaban lalu Konfirmasi Jawaban; periksa kunci/pembahasan. Mode Ujian tetap memakai timer dan tidak menampilkan konfirmasi drilling.
4. Tryout dua mapel: Berikutnya pada akhir mapel membawa ke mapel selanjutnya. Kembali dan navigasi nomor soal dapat membuka mapel sebelumnya. Timer tetap berjalan.
5. Admin ACC revisi: paket belum dimulai memakai revisi; paket yang sudah berjalan tetap memakai versi sebelumnya.
6. Bank soal/pemilih manual: kombinasikan pembuat dan tanggal dengan mapel, bab, subbab, kesulitan. Daftar jadwal: uji rentang tanggal.

Pengujian browser interaktif dan PostgreSQL produksi belum dilakukan. Perluasan filter/paginasi ke seluruh daftar master tetap pekerjaan lanjutan; skor kohort belum diaktifkan sesuai arahan client.
