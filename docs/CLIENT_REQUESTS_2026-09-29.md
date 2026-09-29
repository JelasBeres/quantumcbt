# Revisi client tahap 2 — 29 September 2026

## Ruang ujian siswa

- **Popup sebelum lanjut bagian / kumpulkan** menampilkan nomor soal yang belum dijawab dan yang ditandai ragu-ragu pada bagian aktif. Bila masih ada yang kosong, tombolnya menjadi "Tetap Lanjut" / "Kembali Mengerjakan".
- **Warna nomor soal**: oranye dan lebih besar = sedang dikerjakan, biru tua = terjawab, kuning = ragu-ragu, garis merah = sudah dibuka tapi belum diisi, putih = belum dikerjakan. Drilling tetap hijau (benar) / merah (salah). Soal yang pernah dibuka disimpan di `localStorage` (`cbt_dibuka_<ujianId>`).
- **Desktop**: nomor soal diperkecil (setinggi chip mapel) agar area soal lebih luas.
- **Mode drilling**: tombol "Kumpulkan" menjadi **"Selesai"**, lalu siswa kembali ke daftar Latihan. Sesi drilling **tidak masuk riwayat** (`GET /siswa/riwayat-latihan` mengecualikan `mode_latihan = "drill"`). Mode latihan biasa tetap masuk riwayat.

## Halaman siswa

- Menu desktop **"Ujian Aktif" dihapus**.
- Kartu kategori Try Out / Latihan dibuat **satu kartu penuh per baris** dengan ikon. Kategori aktif berwarna (warna bergiliran per kategori), kategori yang belum ada paketnya abu-abu dengan ikon gembok.
- Tombol "Lihat Mapel" diganti **"Kerjakan Set Soal"**.

## Editor soal

- Tombol **rata kanan-kiri (justify)**.
- **Lebar kolom tabel bisa digeser**: tarik garis kanan sel. Lebar disimpan sebagai `width` per sel.

## Admin & guru

- Dashboard admin: kartu **"Tindakan yang Perlu Diperhatikan"** memuat pengajuan soal (per mapel), set soal paket, dan jadwal yang menunggu persetujuan. Setiap baris bisa diklik dan langsung membuka halaman terkait (`GET /dashboard/perlu-tindakan`).
- **Ekspor PDF set soal** (tombol di kartu set soal, sejajar Isi Soal/Atur Durasi). Isi bisa dipilih: soal, kunci jawaban, pembahasan. Halaman cetak `/cetak/set-soal` membuka dialog cetak browser ("Simpan sebagai PDF"). Admin bisa mengekspor semua set; guru bisa mengekspor set pada mapel yang diampunya walau soalnya dibuat guru lain (`GET /paket-ujian/{id}/bagian/{bagian_id}/ekspor`).
- Menu **"Analisis Soal" → "Laporan Soal"**.
- Rekap Nilai: admin bisa **Reset** pengerjaan siswa (`DELETE /ujian-siswa/{id}/reset`). Jawaban, nilai, dan log attempt itu dihapus, dan nilai kohort peserta lain dihitung ulang. Siswa bisa mengerjakan ulang selama jadwal masih berlangsung. Kalau jadwal sudah berakhir, jadwalnya perlu diperpanjang dulu.
- Rekap Nilai: statistik "Lulus (≥75)" dan warna nilai hanya berlaku untuk paket penilaian biasa, tidak untuk paket kohort (skala 0–1000).

- **Isi Soal → Pilih Manual** mengikuti sketsa client: satu baris filter (Bab, Sub Bab, Tingkat Kesulitan, Pembuat Soal, Tgl dibuat, Sampai Tgl, Reset), lalu chip tipe soal diawali **Semua** (default). Kolom cari yang dobel dijadikan satu, di kanan baris chip.
- **Isi Soal → Auto-Generate** mengikuti sketsa client: Kelas Paket, Mata Pelajaran, Bab, Sub Bab, lalu Tipe Soal dan Tingkat Kesulitan. Tipe Soal kini punya opsi **Campuran** (acak dari semua tipe; `POST /soal/generate-kandidat` menerima `tipe = "campuran"`).
- **KKM per paket** (kolom `paket_ujian.kkm`, default 75, migrasi `c8q9r0s1t2u3`). Diisi di form Buat/Edit Paket, di sebelah Metode Penilaian (hanya Nilai Biasa). Rekap Nilai, status Lulus/Belum lulus, ekspor Excel, dan statistik lulus dashboard memakai KKM paket masing-masing.
- **Unduh soal mengikuti template client** (`/cetak/set-soal`): tombol "Unduh Soal" di kartu set soal membuka halaman dengan tab **Naskah soal** / **Kunci & pembahasan** dan tombol **Unduh PDF**. Setiap lembar A4 berkop logo Quantum Research + nama set, "<kategori> — <mapel>", kelas, watermark logo, dan "Halaman x dari y"; soal tidak terpotong antarhalaman.
