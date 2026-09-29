"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import MathContent from "@/components/MathContent";
import { api, getErrorMessage } from "@/lib/api";

// Halaman cetak set soal untuk ekspor PDF (admin & guru). Isi dipilih lewat
// ?isi=soal,kunci,pembahasan; dialog cetak browser dibuka otomatis, lalu
// pengguna memilih "Simpan sebagai PDF".
type EksporSoal = {
  nomor: number;
  soal_id: number;
  tipe: string;
  teks_soal: string;
  opsi: { teks: string; is_benar: boolean }[];
  pernyataan: { teks: string; is_benar: boolean }[];
  label_benar?: string | null;
  label_salah?: string | null;
  kunci_jawaban?: string | null;
  pembahasan?: string | null;
};
type Ekspor = {
  paket_nama: string;
  bagian_nama: string;
  pelajaran_nama?: string | null;
  durasi_menit?: number | null;
  soal: EksporSoal[];
};

const huruf = (index: number) => String.fromCharCode(65 + index);

function KunciSingkat({ soal }: { soal: EksporSoal }) {
  if (soal.tipe === "benar_salah" && soal.pernyataan.length > 0) {
    return (
      <span>
        {soal.pernyataan.map((p, i) => `${i + 1}. ${p.is_benar ? soal.label_benar || "Benar" : soal.label_salah || "Salah"}`).join("; ")}
      </span>
    );
  }
  if (soal.opsi.length > 0) {
    const kunci = soal.opsi.map((o, i) => (o.is_benar ? huruf(i) : null)).filter(Boolean);
    return <span className="font-bold">{kunci.length ? kunci.join(", ") : "-"}</span>;
  }
  if (soal.kunci_jawaban) return <MathContent className="inline-block [&_p]:my-0" html={soal.kunci_jawaban} />;
  return <span className="text-gray-500">Belum ada kunci</span>;
}

function CetakSetSoal() {
  const params = useSearchParams();
  const paketId = params.get("paket");
  const bagianId = params.get("bagian");
  const isi = new Set((params.get("isi") || "soal,kunci,pembahasan").split(","));
  const tampilSoal = isi.has("soal");
  const tampilKunci = isi.has("kunci");
  const tampilPembahasan = isi.has("pembahasan");
  const [data, setData] = useState<Ekspor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paketId || !bagianId) {
      setError("Set soal tidak ditemukan.");
      return;
    }
    api.get<Ekspor>(`/paket-ujian/${paketId}/bagian/${bagianId}/ekspor`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Data set soal gagal dimuat.")));
  }, [paketId, bagianId]);

  useEffect(() => {
    if (!data) return;
    // Beri waktu KaTeX & gambar dirender sebelum dialog cetak dibuka.
    const timer = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(timer);
  }, [data]);

  const judulIsi = [tampilSoal && "Soal", tampilKunci && "Kunci Jawaban", tampilPembahasan && "Pembahasan"].filter(Boolean).join(", ");

  useEffect(() => {
    if (data) document.title = `${data.paket_nama} - ${data.bagian_nama} (${judulIsi})`;
  }, [data, judulIsi]);

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>;
  if (!data) return <p className="p-8 text-center text-gray-500">Menyiapkan dokumen…</p>;

  return (
    <div className="cetak-root mx-auto max-w-[210mm] bg-white px-8 py-6 text-[13px] leading-relaxed text-black">
      <div className="cetak-toolbar mb-5 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 print:hidden">
        <p className="text-sm text-gray-600">Pilih <b>Simpan sebagai PDF</b> pada dialog cetak untuk mengunduh PDF.</p>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
          <Printer className="h-4 w-4" /> Cetak / Simpan PDF
        </button>
      </div>

      <header className="mb-5 flex items-center gap-4 border-b-2 border-black pb-3">
        <Image src="/quantum-research-logo.png" alt="" width={52} height={52} className="h-13 w-13 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Quantum Research</p>
          <h1 className="text-lg font-bold">{data.paket_nama}</h1>
          <p className="text-sm">
            {data.bagian_nama}
            {data.pelajaran_nama ? ` · ${data.pelajaran_nama}` : ""}
            {data.durasi_menit ? ` · ${data.durasi_menit} menit` : ""} · {data.soal.length} soal
          </p>
        </div>
        <span className="rounded border border-black px-2 py-1 text-xs font-semibold">{judulIsi}</span>
      </header>

      {data.soal.length === 0 && <p className="text-gray-500">Belum ada soal pada set ini.</p>}

      {tampilSoal ? (
        <ol className="space-y-5">
          {data.soal.map((soal) => (
            <li key={soal.soal_id} className="cetak-soal break-inside-avoid">
              <div className="flex gap-2">
                <span className="w-6 shrink-0 font-bold">{soal.nomor}.</span>
                <div className="min-w-0 flex-1">
                  <MathContent className="rich-content max-w-none" html={soal.teks_soal} />
                  {soal.tipe === "benar_salah" && soal.pernyataan.length > 0 ? (
                    <table className="mt-2 w-full border-collapse text-[12px]">
                      <thead>
                        <tr>
                          <th className="border border-gray-400 px-2 py-1 text-left">Pernyataan</th>
                          <th className="w-20 border border-gray-400 px-2 py-1">{soal.label_benar || "Benar"}</th>
                          <th className="w-20 border border-gray-400 px-2 py-1">{soal.label_salah || "Salah"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {soal.pernyataan.map((p, i) => (
                          <tr key={i}>
                            <td className="border border-gray-400 px-2 py-1"><MathContent className="[&_p]:my-0" html={p.teks} /></td>
                            <td className="border border-gray-400 px-2 py-1 text-center font-bold">{tampilKunci && p.is_benar ? "✓" : ""}</td>
                            <td className="border border-gray-400 px-2 py-1 text-center font-bold">{tampilKunci && !p.is_benar ? "✓" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : soal.opsi.length > 0 ? (
                    <ol className="mt-2 space-y-1">
                      {soal.opsi.map((o, i) => (
                        <li key={i} className={`flex gap-2 ${tampilKunci && o.is_benar ? "font-bold" : ""}`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${tampilKunci && o.is_benar ? "border-black bg-black text-white" : "border-gray-500"}`}>{huruf(i)}</span>
                          <MathContent className="min-w-0 flex-1 [&_p]:my-0" html={o.teks} />
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {tampilKunci && (soal.tipe === "isian" || soal.tipe === "esai") && (
                    <p className="mt-2"><b>Kunci:</b> <KunciSingkat soal={soal} /></p>
                  )}
                  {tampilPembahasan && (
                    <div className="mt-2 border-l-2 border-gray-400 pl-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">Pembahasan</p>
                      {soal.pembahasan ? <MathContent className="rich-content max-w-none" html={soal.pembahasan} /> : <p className="text-gray-500">Belum ada pembahasan.</p>}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          {tampilKunci && (
            <section className="mb-6">
              <h2 className="mb-2 text-base font-bold">Kunci Jawaban</h2>
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {data.soal.map((soal) => (
                    <tr key={soal.soal_id} className="break-inside-avoid">
                      <td className="w-12 border border-gray-400 px-2 py-1 text-center font-bold">{soal.nomor}</td>
                      <td className="border border-gray-400 px-2 py-1"><KunciSingkat soal={soal} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {tampilPembahasan && (
            <section>
              <h2 className="mb-2 text-base font-bold">Pembahasan</h2>
              <ol className="space-y-4">
                {data.soal.map((soal) => (
                  <li key={soal.soal_id} className="flex gap-2 break-inside-avoid">
                    <span className="w-6 shrink-0 font-bold">{soal.nomor}.</span>
                    <div className="min-w-0 flex-1">
                      {tampilKunci && <p className="mb-1"><b>Kunci:</b> <KunciSingkat soal={soal} /></p>}
                      {soal.pembahasan ? <MathContent className="rich-content max-w-none" html={soal.pembahasan} /> : <p className="text-gray-500">Belum ada pembahasan.</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <style jsx global>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print {
          body { background: #fff !important; }
          .cetak-root { max-width: none; padding: 0; }
        }
        .cetak-root img { max-width: 100%; height: auto; }
      `}</style>
    </div>
  );
}

export default function CetakSetSoalPage() {
  return (
    <RoleGuard roles={["admin", "guru"]}>
      <Suspense fallback={<p className="p-8 text-center text-gray-500">Menyiapkan dokumen…</p>}>
        <CetakSetSoal />
      </Suspense>
    </RoleGuard>
  );
}
