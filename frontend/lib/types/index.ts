export type Program = {
  id: number;
  nama: string;
  deskripsi?: string | null;
  is_active: boolean;
};

export type Pelajaran = {
  id: number;
  nama: string;
  program_id?: number | null;
  is_active: boolean;
};

export type Kelas = {
  id: number;
  nama: string;
};

export type Topik = {
  id: number;
  pelajaran_id: number;
  nama: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Subbab = {
  id: number;
  topik_id: number;
  pelajaran_id?: number | null;
  nama: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Siswa = {
  sekolah?: string | null;
  pilihan_jurusan?: { jurusan: string; universitas: string }[] | null;
  id: number;
  user_id: number;
  nama_lengkap: string;
  no_induk?: string | null;
  program_id?: number | null;
  kelas_id?: number | null;
  username?: string | null;
};

export type KategoriPaket = {
  id: number;
  kode: string;
  nama: string;
  deskripsi?: string | null;
  tipe: "ujian" | "latihan" | "keduanya";
  is_active: boolean;
  jumlah_paket?: number;
  created_at?: string;
  updated_at?: string;
};

export type PaketUjian = {
  assigned_guru_ids?: number[] | null;
  id: number;
  nama: string;
  deskripsi?: string | null;
  durasi_menit: number;
  jumlah_soal: number;
  is_random_soal: boolean;
  is_random_opsi: boolean;
  pelajaran_id?: number | null;
  kelas_id?: number | null;
  program_id?: number | null;
  tipe?: "ujian" | "latihan" | string;
  kategori_id?: number | null;
  kategori?: string | null;
  kategori_nama?: string | null;
  metode_penilaian?: "biasa" | "kohort";
  skala_kohort?: "utbk" | "tka";
  izinkan_pilih_mapel?: boolean;
  kkm?: number;
  jumlah_bagian?: number;
  jumlah_bagian_kosong?: number;
  jumlah_bagian_approved?: number;
  siap_dipublikasikan?: boolean;
  created_by?: number | null;
  is_archived?: boolean;
  archived_at?: string | null;
};

export type JadwalUjian = {
  id: number;
  paket_ujian_id: number;
  mulai: string;
  selesai: string;
  is_published: boolean;
  program_id?: number | null;
  kelas_id?: number | null;
  durasi_menit_paket?: number | null;
  status?: "draft" | "pending_review" | "rejected" | "published";
  created_by?: number | null;
  reviewed_by?: number | null;
  submitted_for_review_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

// Mapel di paket latihan; set soalnya adalah bagian dengan pelajaran_id yang sama.
export type PaketMapel = {
  pelajaran_id: number;
  nama: string;
  urutan: number;
  jumlah_set: number;
  jumlah_set_approved: number;
  jumlah_soal: number;
};

export type BagianPaket = {
  id: number;
  paket_ujian_id: number;
  nama: string;
  urutan: number;
  durasi_menit?: number | null;
  pelajaran_id?: number | null;
  is_random_soal?: boolean | null;
  is_random_opsi?: boolean | null;
  deskripsi?: string | null;
  jumlah_soal: number;
  soal_ids: number[];
  status?: "draft" | "pending_review" | "revision_required" | "approved" | string;
  review_note?: string | null;
  submitted_for_review_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  revision_number?: number;
  guru_pengampu?: string | null;
  reviewer_nama?: string | null;
};

export type Soal = {
  subbab_id?: number | null;
  subbab?: string | null;
  id: number;
  paket_ujian_id?: number | null;
  pelajaran_id?: number | null;
  kelas_id?: number | null;
  topik_id?: number | null;
  teks_soal: string;
  tipe: string;
  gambar_url?: string | null;
  tingkat_kesulitan?: "mudah" | "sedang" | "sulit" | null;
  poin?: number;
  kunci_jawaban?: string | null;
  label_benar?: string | null;
  label_salah?: string | null;
  pernyataan?: PernyataanBenarSalah[];
  pembahasan?: string | null;
  status?: "draft" | "pending_review" | "rejected" | "approved" | "archived";
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
  reviewed_by?: number | null;
  submitted_for_review_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  parent_soal_id?: number | null;
  version?: number;
  opsi_jawaban?: OpsiJawaban[];
};

export type Pengaturan = {
  id: number;
  key: string;
  value: unknown;
};

export type LoginActivity = {
  id: number;
  user_id?: number | null;
  username: string;
  ip_address?: string | null;
  successful: boolean;
  created_at: string;
};

export type PernyataanBenarSalah = {
  id: number;
  soal_id: number;
  teks_pernyataan: string;
  urutan: number;
  is_benar?: boolean;
};

export type PernyataanBenarSalahAdmin = Omit<PernyataanBenarSalah, "is_benar"> & {
  is_benar: boolean;
};

export type OpsiJawaban = {
  id: number;
  soal_id: number;
  teks_opsi: string;
  is_benar?: boolean;
  urutan?: number | null;
};

export type OpsiJawabanAdmin = OpsiJawaban & {
  is_benar: boolean;
};
