// Nilai biasa (0–100) dan benchmark kohort (TKA 200–800, UTBK 0–1000) memakai
// skala berbeda, jadi rata-rata/tertinggi/terendah tidak boleh dicampur.

export type SkalaNilai = "biasa" | "tka" | "utbk";

type BarisNilai = {
  skor?: number | null;
  metode_penilaian?: string | null;
  skala?: string | null;
  kohort_status?: string | null;
};

export type RingkasanSkala = {
  skala: SkalaNilai;
  jumlah: number;
  rata: number;
  tertinggi: number;
  terendah: number;
  // Ada nilai kohort berstatus sementara (peserta < 5 / esai belum dikoreksi).
  adaSementara: boolean;
};

export const RENTANG_SKALA: Record<SkalaNilai, string> = {
  biasa: "0–100",
  tka: "200–800",
  utbk: "0–1000",
};

export const NAMA_SKALA: Record<SkalaNilai, string> = {
  biasa: "Nilai Biasa",
  tka: "Kohort TKA",
  utbk: "Kohort UTBK",
};

const URUTAN: SkalaNilai[] = ["biasa", "tka", "utbk"];

export function skalaNilai(row: BarisNilai): SkalaNilai {
  if (row.metode_penilaian !== "kohort") return "biasa";
  return row.skala === "tka" ? "tka" : "utbk";
}

// Nilai biasa satu desimal, kohort bilangan bulat seperti skala resminya.
export function formatNilai(skor: number, skala: SkalaNilai): string {
  return skala === "biasa" ? skor.toFixed(1) : skor.toFixed(0);
}

export function ringkasPerSkala(rows: BarisNilai[]): RingkasanSkala[] {
  const grup = new Map<SkalaNilai, { skor: number[]; adaSementara: boolean }>();
  for (const row of rows) {
    if (row.skor == null) continue;
    const skala = skalaNilai(row);
    const item = grup.get(skala) ?? { skor: [], adaSementara: false };
    item.skor.push(row.skor);
    if (skala !== "biasa" && row.kohort_status !== "final") item.adaSementara = true;
    grup.set(skala, item);
  }
  return URUTAN.filter((skala) => grup.has(skala)).map((skala) => {
    const { skor, adaSementara } = grup.get(skala)!;
    return {
      skala,
      jumlah: skor.length,
      rata: skor.reduce((a, b) => a + b, 0) / skor.length,
      tertinggi: Math.max(...skor),
      terendah: Math.min(...skor),
      adaSementara,
    };
  });
}
