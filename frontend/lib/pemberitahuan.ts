export type JenisPemberitahuan = "info" | "promo" | "paket_baru";

export type Pemberitahuan = {
  id: number;
  judul: string;
  isi?: string | null;
  jenis: JenisPemberitahuan;
  tautan?: string | null;
  program_id?: number | null;
  kelas_id?: number | null;
  tampil_popup: boolean;
  is_active: boolean;
  berlaku_sampai?: string | null;
  jadwal_ujian_id?: number | null;
  created_at?: string | null;
};

export type PemberitahuanSiswa = Pemberitahuan & { dibaca: boolean };
export type PemberitahuanAdmin = Pemberitahuan & { jumlah_dibaca: number };

export const JENIS_LABEL: Record<JenisPemberitahuan, string> = {
  info: "Info",
  promo: "Promo",
  paket_baru: "Paket Baru",
};

export function isTautanLuar(tautan: string): boolean {
  return /^https?:\/\//i.test(tautan);
}

export function waktuRelatif(value?: string | null): string {
  if (!value) return "";
  const detik = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (detik < 60) return "Baru saja";
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 7 * 86400) return `${Math.floor(detik / 86400)} hari lalu`;
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
