"use client";

import { ReactNode, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Button from "@/components/Button";
import MathContent from "@/components/MathContent";
import { api, getErrorMessage } from "@/lib/api";
import { Soal } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

const OPSI_LABEL = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Props = {
  soalId: number | null;
  onClose: () => void;
  // Tombol aksi tambahan di footer (mis. Edit Soal), menerima detail soal yang dimuat.
  actions?: (soal: Soal) => ReactNode;
};

// Pratinjau satu soal utuh: teks soal, pilihan + kunci jawaban, dan pembahasan.
export default function SoalPreviewDialog({ soalId, onClose, actions }: Props) {
  const [soal, setSoal] = useState<Soal | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (soalId == null) return;
    let active = true;
    setSoal(null);
    setError("");
    api.get(`/soal/${soalId}`)
      .then(({ data }) => { if (active) setSoal(data); })
      .catch((err) => { if (active) setError(getErrorMessage(err, "Soal gagal dimuat.")); });
    return () => { active = false; };
  }, [soalId]);

  useEffect(() => {
    if (soalId == null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [soalId, onClose]);

  if (soalId == null) return null;

  const opsi = soal?.opsi_jawaban ?? [];
  const pernyataan = soal?.pernyataan ?? [];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="soal-preview-title" className="my-6 w-full max-w-3xl rounded-modal bg-card-bg shadow-modal" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-card-border p-5">
          <h2 id="soal-preview-title" className="text-lg font-bold text-heading-dark">Pratinjau Soal #{soalId}</h2>
          {soal && (
            <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted">
              <span>{labelTipeSoal(soal.tipe)}</span><span>·</span>
              <span className="capitalize">{soal.tingkat_kesulitan ?? "sedang"}</span><span>·</span>
              <span>{soal.poin ?? 1} poin</span>
              {soal.subbab && <><span>·</span><span>{soal.subbab}</span></>}
            </p>
          )}
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          {error && <p className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {!soal && !error && <p className="py-8 text-center text-sm text-text-muted">Memuat soal...</p>}
          {soal && (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Soal</h3>
                {soal.gambar_url && <img src={soal.gambar_url} alt="" className="mb-3 max-h-72 w-auto max-w-full rounded-input border border-card-border" />}
                <MathContent className="prose prose-sm max-w-none" html={soal.teks_soal} />
              </section>

              {(soal.tipe === "pilihan_ganda" || soal.tipe === "pilihan_lebih_dari_satu") && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Pilihan Jawaban</h3>
                  {opsi.length === 0 ? <p className="text-sm text-text-muted">Belum ada pilihan jawaban.</p> : (
                    <ul className="space-y-2">
                      {opsi.map((item, index) => (
                        <li key={item.id} className={`flex items-start gap-3 rounded-input border px-3 py-2 text-sm ${item.is_benar ? "border-green-300 bg-green-50" : "border-card-border"}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.is_benar ? "bg-green-600 text-white" : "bg-neutral text-body-dark"}`}>{OPSI_LABEL[index] ?? index + 1}</span>
                          <MathContent className="prose prose-sm min-w-0 flex-1 max-w-none [&_p]:my-0" html={item.teks_opsi} />
                          {item.is_benar && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kunci</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {soal.tipe === "benar_salah" && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Pernyataan & Kunci</h3>
                  <div className="overflow-x-auto rounded-input border border-card-border">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-neutral text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          <th scope="col" className="w-10 px-3 py-2 text-center">No</th>
                          <th scope="col" className="px-3 py-2">Pernyataan</th>
                          <th scope="col" className="w-28 px-3 py-2 text-center">Kunci</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pernyataan.map((item, index) => (
                          <tr key={item.id} className="border-t border-card-border">
                            <td className="px-3 py-2 text-center text-text-muted">{index + 1}</td>
                            <td className="px-3 py-2"><MathContent className="prose prose-sm max-w-none [&_p]:my-0" html={item.teks_pernyataan} /></td>
                            <td className="px-3 py-2 text-center font-semibold text-green-700">{item.is_benar ? soal.label_benar || "Benar" : soal.label_salah || "Salah"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {(soal.tipe === "isian" || soal.tipe === "esai") && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{soal.tipe === "esai" ? "Kunci / Rubrik Jawaban" : "Kunci Jawaban"}</h3>
                  {soal.kunci_jawaban ? <div className="rounded-input border border-green-300 bg-green-50 px-3 py-2 text-sm"><MathContent className="prose prose-sm max-w-none [&_p]:my-0" html={soal.kunci_jawaban} /></div> : <p className="text-sm text-text-muted">Belum ada kunci jawaban.</p>}
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Pembahasan</h3>
                {soal.pembahasan ? <div className="rounded-input border border-card-border bg-neutral/40 px-3 py-2"><MathContent className="prose prose-sm max-w-none" html={soal.pembahasan} /></div> : <p className="text-sm text-text-muted">Belum ada pembahasan.</p>}
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-card-border p-5">
          {soal && actions?.(soal)}
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}
