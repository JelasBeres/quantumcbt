export const TIPE_SOAL_LABEL: Record<string, string> = {
  pilihan_ganda: "Pilihan Ganda",
  pilihan_lebih_dari_satu: "Pilihan Lebih dari Satu",
  benar_salah: "Benar / Salah",
  esai: "Esai",
  isian: "Isian"
};

export function labelTipeSoal(tipe?: string | null): string {
  if (!tipe) return "-";
  return TIPE_SOAL_LABEL[tipe] ?? tipe;
}
