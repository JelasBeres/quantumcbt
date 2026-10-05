# Revisi client tahap 3 — 30 September s.d. 3 Oktober 2026

Status: online di VPS (deploy 3 Oktober 2026, sampai commit `d2de186`).

## Try Out TKA: mapel wajib dan mapel pilihan

- Bagian paket bisa ditandai **wajib** atau **pilihan**. Paket punya aturan
  **minimal/maksimal mapel pilihan** (`paket_ujian.min_mapel_pilihan`, `max_mapel_pilihan`).
- Sebelum mulai, siswa memilih mapel pilihan di halaman detail try out. Panel pilih
  mapel selalu tampil untuk paket TKA, juga saat "Bisa Lihat Mapel" = Tidak.
- Paket yang tidak punya mapel pilihan langsung dimulai tanpa memilih.
- Siswa hanya menerima soal dari mapel wajib + mapel pilihannya
  (`POST /ujian-siswa/mulai` menerima `selected_pelajaran_ids`).
- Durasi pengerjaan = jumlah durasi mapel yang benar-benar dikerjakan, dibatasi
  durasi paket.
- Jadwal ditolak bila aturan mapel pilihan tidak bisa dipenuhi siswa (mis. minimal 2
  pilihan tetapi paket hanya punya 1 mapel pilihan).

## Penilaian

- Kohort menilai tiap peserta hanya dari soal yang ia terima. Nilai sempurna TKA
  sekarang 800 (sebelumnya 500, karena soal mapel pilihan lain ikut dihitung salah).
- Peserta yang baru mengumpulkan langsung mendapat nilai kohort.
- Esai yang tidak dijawab bernilai 0 dan tidak lagi menahan status "menunggu koreksi".
- **Kunci, pembahasan, dan nilai try out ditahan** untuk siswa sampai semua jadwal
  paket itu berakhir, agar kunci tidak tersebar ke peserta yang belum mengerjakan.
  Admin dan guru tetap melihat semuanya.
- Rata-rata nilai dipisah per skala: nilai biasa (0–100), kohort TKA (200–800), dan
  kohort UTBK (0–1000). Berlaku di dashboard siswa, dashboard admin
  (`rata_rata_per_skala`), dan Rekap Nilai.

## Jadwal

- Jadwal yang sudah dikerjakan siswa hanya bisa diubah **waktu selesainya**; paket dan
  waktu mulai terkunci. Waktu mulai dibandingkan per menit (sesuai presisi form).

## Rekap nilai

- Guru hanya melihat rekap paket untuk mapel yang diampu.
- Latihan per mapel dari paket try out dan sesi drilling tidak masuk rekap (tidak
  menggandakan siswa). Nilai kohort di Excel tidak diwarnai lulus/belum lulus.

## Bank soal & editor

- Editor soal diganti ke **Tiptap**: toolbar format (tebal, miring, superskrip,
  subskrip, rata, warna, tabel, gambar, rumus) dengan indikator status yang akurat.
- Soal yang belum lengkap tidak bisa diajukan maupun disetujui: PG/PG lebih dari
  satu/Benar-Salah tanpa opsi atau pernyataan yang valid, dan isian tanpa kunci.
- Opsi kosong tidak ikut disimpan. Gambar/rumus dihitung sebagai isi yang valid.
- Opsi dipertahankan saat berpindah tipe PG ↔ PG lebih dari satu.

## Halaman siswa & login

- Pesan error ruang ujian dan login dalam bahasa Indonesia. Setelah sesi habis,
  siswa diarahkan kembali ke halaman asal setelah login.
- Try out yang sudah dikerjakan menampilkan tombol **Lihat Hasil**.
- Perbaikan tampilan HP: kartu try out tunggal selebar layar, riwayat, pemilih mapel,
  dan navigasi halaman pembahasan.
