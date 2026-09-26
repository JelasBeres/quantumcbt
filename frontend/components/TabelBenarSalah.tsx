"use client";

import MathContent from "@/components/MathContent";

// Soal tipe Benar/Salah ditampilkan sebagai tabel ala UTBK/TKA:
// No | Pernyataan | Benar | Salah, satu pilihan per baris.
type Pernyataan = { pernyataan_id: number; teks: string };

type Props = {
  pernyataan: Pernyataan[];
  jawaban: { pernyataan_id: number; jawaban: boolean }[];
  labelBenar?: string | null;
  labelSalah?: string | null;
  disabled?: boolean;
  onPilih: (pernyataanId: number, value: boolean) => void;
  // Mode drilling setelah konfirmasi: pernyataan_id -> jawaban yang benar.
  // Pilihan siswa diwarnai hijau (benar) / merah (salah), kunci ditandai hijau.
  kunci?: Record<number, boolean> | null;
};

export default function TabelBenarSalah({ pernyataan, jawaban, labelBenar, labelSalah, disabled, onPilih, kunci }: Props) {
  const label = (value: boolean) => (value ? labelBenar || "Benar" : labelSalah || "Salah");

  return (
    <div className="animate-question-in overflow-x-auto rounded-input border border-card-border">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-neutral text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th scope="col" className="w-9 px-1 py-2.5 text-center sm:w-10 sm:px-3">No</th>
            <th scope="col" className="px-3 py-2.5">Pernyataan</th>
            {[true, false].map((value) => (
              <th key={String(value)} scope="col" className="w-16 break-words px-1 py-2.5 text-center sm:w-24 sm:px-2">{label(value)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pernyataan.map((row, index) => {
            const selected = jawaban.find((item) => item.pernyataan_id === row.pernyataan_id)?.jawaban;
            return (
              <tr key={row.pernyataan_id} className="border-t border-card-border align-middle">
                <td className="px-1 py-3 text-center font-semibold text-text-muted sm:px-3">{index + 1}</td>
                <td className="px-2 py-3 sm:px-3">
                  <MathContent className="prose prose-sm max-w-none text-body-dark prose-p:my-0 prose-p:text-body-dark" html={row.teks} />
                </td>
                {[true, false].map((value) => {
                  const checked = selected === value;
                  const isKunci = kunci != null && kunci[row.pernyataan_id] === value;
                  const warna = kunci == null
                    ? checked
                      ? "border-brand-primary bg-brand-primary"
                      : "border-card-border bg-card-bg hover:border-brand-primary"
                    : checked
                      ? isKunci ? "border-green-600 bg-green-600" : "border-red-600 bg-red-600"
                      : isKunci ? "border-green-600 bg-green-50" : "border-card-border bg-card-bg";
                  return (
                    <td key={String(value)} className="px-1 py-3 text-center sm:px-2">
                      <button
                        type="button"
                        aria-pressed={checked}
                        aria-label={`${label(value)} untuk pernyataan ${index + 1}${isKunci ? " (kunci)" : ""}`}
                        disabled={disabled || kunci != null}
                        onClick={() => onPilih(row.pernyataan_id, value)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${kunci == null ? "disabled:opacity-60" : ""} ${warna}`}
                      >
                        {checked && <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
