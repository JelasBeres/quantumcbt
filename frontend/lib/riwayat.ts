import { api } from "./api";

// Riwayat dibagi dua grup: Tryout (kategori -> tryout -> mapel -> pembahasan)
// dan Latihan (kategori -> sesi latihan -> pembahasan).

export const KATEGORI_LAINNYA = "lainnya";

export type RiwayatItem = {
  ujian_siswa_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  kategori?: string | null;
  kategori_nama?: string | null;
  jadwal_ujian_id?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  is_submitted: boolean;
  skor?: number | null;
  metode_penilaian?: "biasa" | "kohort";
  kohort_status?: "sementara" | "final" | "kosong" | null;
  skala?: "utbk" | "tka" | null;
};

export type SoalHasil = {
  soal_id: number;
  tipe: string;
  bagian_id?: number | null;
  jawaban_user?: unknown;
  is_correct?: boolean | null;
  is_ragu?: boolean;
};

export type BagianHasil = {
  bagian_id?: number | null;
  nama: string;
  urutan: number;
  pelajaran_id?: number | null;
  pelajaran_nama?: string | null;
};

export type DetailHasil = {
  ujian_siswa_id: number;
  skor?: number | null;
  nama_paket?: string | null;
  soal: SoalHasil[];
  bagian?: BagianHasil[];
  kunci_disembunyikan?: boolean;
  kunci_tersedia_at?: string | null;
};

// ragu = jumlah soal yang ditandai ragu-ragu (tumpang tindih dengan status lain).
export type Ringkasan = { benar: number; salah: number; kosong: number; menunggu: number; terjawab: number; ragu: number };

export function kategoriKey(item: Pick<RiwayatItem, "kategori">): string {
  return item.kategori || KATEGORI_LAINNYA;
}

export async function fetchRiwayatTryout(): Promise<RiwayatItem[]> {
  const { data } = await api.get<RiwayatItem[]>("/siswa/riwayat-ujian");
  return (data ?? []).filter((item) => item.is_submitted && item.jadwal_ujian_id != null);
}

export type RiwayatLatihanItem = {
  ujian_siswa_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  // "tryout" = latihan per-mapel dari paket tryout yang sudah dikerjakan.
  sumber: "latihan" | "tryout";
  kategori?: string | null;
  kategori_nama?: string | null;
  mode_latihan?: "latihan" | "drill" | null;
  bagian_id?: number | null;
  bagian_nama?: string | null;
  pelajaran_id?: number | null;
  pelajaran_nama?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  skor?: number | null;
};

export async function fetchRiwayatLatihan(): Promise<RiwayatLatihanItem[]> {
  const { data } = await api.get<RiwayatLatihanItem[]>("/siswa/riwayat-latihan");
  return data ?? [];
}

// Riwayat Latihan dikelompokkan: kategori -> mapel -> set soal -> sesi (percobaan).
// Sesi tanpa mapel (latihan satu paket penuh / bagian tanpa mapel) masuk grup "lainnya".
export const MAPEL_LAINNYA = "lainnya";

export function mapelKey(item: Pick<RiwayatLatihanItem, "pelajaran_id">): string {
  return item.pelajaran_id != null ? String(item.pelajaran_id) : MAPEL_LAINNYA;
}

export type GrupSet = {
  key: string;
  nama: string;
  nama_paket: string;
  // Terbaru lebih dulu (urutan dari API: finished_at desc).
  sesi: RiwayatLatihanItem[];
};

export type GrupMapel = {
  key: string;
  nama: string;
  sets: GrupSet[];
  jumlahSesi: number;
  terakhir?: string | null;
};

export function kelompokkanPerMapel(items: RiwayatLatihanItem[]): GrupMapel[] {
  const mapel = new Map<string, GrupMapel>();
  for (const item of items) {
    const kunciMapel = mapelKey(item);
    let grup = mapel.get(kunciMapel);
    if (!grup) {
      grup = { key: kunciMapel, nama: item.pelajaran_nama || "Lainnya", sets: [], jumlahSesi: 0, terakhir: item.finished_at };
      mapel.set(kunciMapel, grup);
    }
    grup.jumlahSesi += 1;
    const kunciSet = item.bagian_id != null ? `b${item.bagian_id}` : `p${item.paket_ujian_id}`;
    let set = grup.sets.find((s) => s.key === kunciSet);
    if (!set) {
      set = { key: kunciSet, nama: item.bagian_nama || item.nama_paket, nama_paket: item.nama_paket, sesi: [] };
      grup.sets.push(set);
    }
    set.sesi.push(item);
  }
  // Mapel "Lainnya" di akhir, selebihnya urut abjad.
  return Array.from(mapel.values()).sort((a, b) =>
    a.key === MAPEL_LAINNYA ? 1 : b.key === MAPEL_LAINNYA ? -1 : a.nama.localeCompare(b.nama, "id"),
  );
}

// Samakan logika status per soal dengan halaman hasil, supaya jumlahnya selalu = total soal.
export function statusSoal(soal: SoalHasil, kunciDitahan = false): Exclude<keyof Ringkasan, "ragu"> {
  const jawaban = soal.jawaban_user;
  const kosong = jawaban == null || jawaban === "" || (Array.isArray(jawaban) && jawaban.length === 0);
  if (kosong) return "kosong";
  if (kunciDitahan) return "terjawab";
  if (soal.tipe === "esai" || soal.tipe === "isian") {
    if (soal.is_correct != null) return soal.is_correct ? "benar" : "salah";
    return "menunggu";
  }
  return soal.is_correct ? "benar" : "salah";
}

export function ringkas(soal: SoalHasil[], kunciDitahan = false): Ringkasan {
  const total: Ringkasan = { benar: 0, salah: 0, kosong: 0, menunggu: 0, terjawab: 0, ragu: 0 };
  for (const item of soal) {
    total[statusSoal(item, kunciDitahan)] += 1;
    if (item.is_ragu) total.ragu += 1;
  }
  return total;
}

export function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export function formatSkor(item: Pick<RiwayatItem, "skor" | "metode_penilaian">): string {
  if (item.skor == null) return "Belum tersedia";
  return item.skor.toFixed(item.metode_penilaian === "kohort" ? 0 : 1);
}
