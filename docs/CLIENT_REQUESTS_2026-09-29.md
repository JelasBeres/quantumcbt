# Revisi client tahap 2 — 29 September 2026

Status: semua poin di bawah sudah online di VPS (deploy terakhir `47a6784`, 29-09-2026).

## Ruang ujian siswa

- **Popup sebelum lanjut bagian / kumpulkan** menampilkan nomor soal yang belum dijawab dan yang ditandai ragu-ragu pada bagian aktif. Bila masih ada yang kosong, tombolnya menjadi "Tetap Lanjut" / "Kembali Mengerjakan".
- **Warna nomor soal**: oranye dan lebih besar = sedang dikerjakan, biru tua = terjawab, kuning = ragu-ragu, garis merah = sudah dibuka tapi belum diisi, putih = belum dikerjakan. Drilling tetap hijau (benar) / merah (salah). Soal yang pernah dibuka disimpan di `localStorage` (`cbt_dibuka_<ujianId>`).
- Soal **Benar/Salah majemuk** baru dihitung terjawab bila semua pernyataannya diisi (state ujian mengirim `jumlah_pernyataan`), sama dengan aturan penilaian.
- **Desktop**: nomor soal diperkecil (setinggi chip mapel) agar area soal lebih luas.
- **Mode drilling**: tombol "Kumpulkan" menjadi **"Selesai"**, lalu siswa kembali ke daftar Latihan. Sesi drilling **tidak masuk riwayat** (`GET /siswa/riwayat-latihan` mengecualikan `mode_latihan = "drill"`). Mode latihan biasa tetap masuk riwayat.
- Menyimpan jawaban dan tanda ragu (`/ujian-siswa/{id}/jawab`, `/ragu`) hanya bisa dilakukan oleh siswa pemilik ujian, bukan admin/guru.

## Halaman siswa

- Menu desktop **"Ujian Aktif" dihapus**.
- Kartu kategori Try Out / Latihan dibuat **satu kartu penuh per baris** dengan ikon. Kategori yang punya paket tampil paling atas dan berwarna (bergiliran per kategori); yang belum ada paketnya abu-abu dengan ikon gembok.
- Tombol "Lihat Mapel" diganti **"Kerjakan Set Soal"**.

## Bank soal & editor

- Editor soal: tombol **rata kanan-kiri (justify)**, dan **lebar kolom tabel bisa digeser** (tarik garis kanan sel; disimpan sebagai `width` per sel).
- **Default soal baru: tingkat kesulitan sedang, poin 2.** Soal lama berpoin 1 disamakan menjadi 2 (migrasi `d9r0s1t2u3v4`). Tingkat kesulitan hanya untuk filter/komposisi; poin yang dipakai menghitung nilai.
- **Isi Soal → Pilih Manual** mengikuti sketsa client: satu baris filter (Bab, Sub Bab, Tingkat Kesulitan, Pembuat Soal, Tgl dibuat, Sampai Tgl, Reset), lalu chip tipe soal diawali **Semua** (default). Kolom cari dijadikan satu, di kanan baris chip.
- **Isi Soal → Auto-Generate** mengikuti sketsa client: Kelas Paket, Mata Pelajaran, Bab, Sub Bab, lalu Tipe Soal dan Tingkat Kesulitan. Tipe Soal punya opsi **Campuran** (acak dari semua tipe; `POST /soal/generate-kandidat` menerima `tipe = "campuran"`).

## Unduh soal

- Tombol **"Unduh Soal"** di kartu set soal membuka `/cetak/set-soal` dengan tab **Naskah soal** / **Kunci & pembahasan** dan tombol **Unduh PDF** (dialog cetak browser → "Simpan sebagai PDF").
- Setiap lembar A4 berkop logo Quantum Research, nama set, "<kategori> — <mapel>", kelas, watermark logo, dan "Halaman x dari y". Soal tidak terpotong antarhalaman.
- Admin bisa mengunduh semua set; guru bisa mengunduh set pada mapel yang diampunya walau soalnya dibuat guru lain (`GET /paket-ujian/{id}/bagian/{bagian_id}/ekspor`).

## Admin & penilaian

- Dashboard admin: kartu **"Tindakan yang Perlu Diperhatikan"** memuat pengajuan soal (per mapel), set soal paket, dan jadwal yang menunggu persetujuan. Setiap baris langsung membuka halaman terkait (`GET /dashboard/perlu-tindakan`).
- Menu **"Analisis Soal" → "Laporan Soal"**.
- **KKM per paket** (kolom `paket_ujian.kkm`, default 75, migrasi `c8q9r0s1t2u3`), diisi di form Buat/Edit Paket di sebelah Metode Penilaian (hanya Nilai Biasa). Status Lulus/Belum lulus di Rekap Nilai, ekspor Excel, dan statistik lulus memakai KKM paket masing-masing; paket Benchmark Kohort (skala 0–1000) tidak memakai status lulus.
- Rekap Nilai: admin bisa **Reset** pengerjaan siswa (`DELETE /ujian-siswa/{id}/reset`). Jawaban, nilai, dan log attempt itu dihapus, nilai kohort peserta lain dihitung ulang. Siswa bisa mengerjakan ulang selama jadwal masih berlangsung; jika jadwal sudah berakhir, perpanjang dulu.

## Menunggu konfirmasi client

- Tipe Soal "Campuran": cukup acak dari semua tipe, atau perlu jumlah per tipe?
- Unduh soal: perlu juga unduh satu paket utuh (semua set sekaligus)?
- Posisi input KKM di form paket sudah sesuai?
