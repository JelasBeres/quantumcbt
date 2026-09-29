"use client";

import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import MathContent from "@/components/MathContent";
import { api, getErrorMessage } from "@/lib/api";

// Halaman unduh set soal (admin & guru), mengikuti template client: tab
// "Naskah soal" / "Kunci & pembahasan", lembar A4 berkop logo + watermark, dan
// nomor "Halaman x dari y". "Unduh PDF" membuka dialog cetak browser
// (pilih "Simpan sebagai PDF") sehingga teks & rumus tetap tajam.
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
  kategori_nama?: string | null;
  kelas_nama?: string | null;
  durasi_menit?: number | null;
  soal: EksporSoal[];
};
type Mode = "naskah" | "kunci";

// Ukuran lembar A4 pada 96 dpi (px) dan tata letaknya. Tinggi area isi dipakai
// untuk membagi blok soal ke halaman; blok tidak pernah dipotong di tengah.
const PAGE_H = 1122;
const PAD_X = 60;
const PAD_TOP = 40;
const PAD_BOTTOM = 28;
const HEAD_H = 96;
const FOOT_H = 44;
const GAP = 20;
const PAGE_W = 794;
const CONTENT_W = PAGE_W - PAD_X * 2;
const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOTTOM - HEAD_H - FOOT_H;

const huruf = (index: number) => String.fromCharCode(65 + index);

function KunciSingkat({ soal }: { soal: EksporSoal }) {
  if (soal.tipe === "benar_salah" && soal.pernyataan.length > 0) {
    return <span>{soal.pernyataan.map((p, i) => `${i + 1}. ${p.is_benar ? soal.label_benar || "Benar" : soal.label_salah || "Salah"}`).join("; ")}</span>;
  }
  if (soal.opsi.length > 0) {
    const kunci = soal.opsi.map((o, i) => (o.is_benar ? huruf(i) : null)).filter(Boolean);
    return <span>{kunci.length ? kunci.join(", ") : "-"}</span>;
  }
  if (soal.kunci_jawaban) return <MathContent className="inline-block [&_p]:my-0" html={soal.kunci_jawaban} />;
  return <span className="text-gray-500">Belum ada kunci</span>;
}

function SoalBlock({ soal }: { soal: EksporSoal }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 shrink-0 text-right font-bold">{soal.nomor}.</span>
      <div className="min-w-0 flex-1">
        <MathContent className="rich-content max-w-none" html={soal.teks_soal} />
        {soal.tipe === "benar_salah" && soal.pernyataan.length > 0 ? (
          <table className="mt-2 w-full border-collapse text-[13px]">
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
                  <td className="border border-gray-400 px-2 py-1" />
                  <td className="border border-gray-400 px-2 py-1" />
                </tr>
              ))}
            </tbody>
          </table>
        ) : soal.opsi.length > 0 ? (
          <ol className="mt-2 space-y-1.5">
            {soal.opsi.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 shrink-0 font-bold">{huruf(i)}.</span>
                <MathContent className="min-w-0 flex-1 [&_p]:my-0" html={o.teks} />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

function PembahasanBlock({ soal }: { soal: EksporSoal }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 shrink-0 text-right font-bold">{soal.nomor}.</span>
      <div className="min-w-0 flex-1">
        <p className="mb-1"><span className="font-sans text-[12px] font-bold uppercase tracking-wide text-[#2d3c8f]">Kunci:</span> <b><KunciSingkat soal={soal} /></b></p>
        {soal.pembahasan ? <MathContent className="rich-content max-w-none" html={soal.pembahasan} /> : <p className="text-gray-500">Belum ada pembahasan.</p>}
      </div>
    </div>
  );
}

function KunciRingkasBlock({ soal }: { soal: EksporSoal[] }) {
  return (
    <div>
      <p className="mb-2 font-sans text-[13px] font-bold uppercase tracking-wide text-[#2d3c8f]">Kunci Jawaban</p>
      <div className="grid grid-cols-5 gap-x-4 gap-y-1 rounded border border-gray-300 p-3 text-[13px]">
        {soal.map((s) => (
          <p key={s.soal_id} className="min-w-0 truncate"><b>{s.nomor}.</b> <KunciSingkat soal={s} /></p>
        ))}
      </div>
      <p className="mt-5 font-sans text-[13px] font-bold uppercase tracking-wide text-[#2d3c8f]">Pembahasan</p>
    </div>
  );
}

// Bagi blok ke halaman berdasarkan tinggi terukur (greedy, tanpa memotong blok).
function paginate(heights: number[]): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    const needed = (current.length ? GAP : 0) + height;
    if (current.length && used + needed > CONTENT_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    used += (current.length ? GAP : 0) + height;
    current.push(index);
  });
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

function Lembar({ data, halaman, total, children }: { data: Ekspor; halaman: number; total: number; children: ReactNode }) {
  const subjudul = [data.kategori_nama, data.pelajaran_nama].filter(Boolean).join(" — ");
  return (
    <section className="cetak-sheet">
      <div className="cetak-watermark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/quantum-research-logo.png" alt="" />
        <span>QUANTUM<br />RESEARCH</span>
      </div>
      <header className="cetak-head">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quantum-research-logo.png" alt="" className="h-10 w-10 object-contain" />
          <p className="font-sans text-[13px] font-extrabold italic leading-tight tracking-wide text-[#1f2a44]">QUANTUM<br />RESEARCH</p>
        </div>
        <div className="text-right font-sans">
          <p className="text-[20px] font-bold leading-tight text-[#1f2a44]">{data.bagian_nama}</p>
          {subjudul && <p className="text-[12px] font-semibold text-[#2d3c8f]">{subjudul}</p>}
          {data.kelas_nama && <p className="text-[11px] text-gray-500">{/^kelas/i.test(data.kelas_nama) ? data.kelas_nama : `Kelas ${data.kelas_nama}`}</p>}
        </div>
      </header>
      <div className="cetak-body">{children}</div>
      <footer className="cetak-foot">Halaman {halaman} dari {total}</footer>
    </section>
  );
}

function CetakSetSoal() {
  const params = useSearchParams();
  const paketId = params.get("paket");
  const bagianId = params.get("bagian");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "kunci" ? "kunci" : "naskah");
  const [data, setData] = useState<Ekspor | null>(null);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<number[][] | null>(null);
  const [zoom, setZoom] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paketId || !bagianId) {
      setError("Set soal tidak ditemukan.");
      return;
    }
    api.get<Ekspor>(`/paket-ujian/${paketId}/bagian/${bagianId}/ekspor`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Data set soal gagal dimuat.")));
  }, [paketId, bagianId]);

  const judul = data ? `${[data.kategori_nama, data.pelajaran_nama].filter(Boolean).join(" — ") || data.paket_nama} - ${data.bagian_nama}` : "";

  useEffect(() => {
    if (data) document.title = `${judul} (${mode === "naskah" ? "Naskah Soal" : "Kunci & Pembahasan"})`;
  }, [data, judul, mode]);

  // Lembar A4 diperkecil agar muat di layar HP; saat dicetak kembali 100%.
  useEffect(() => {
    const update = () => setZoom(Math.min(1, (window.innerWidth - 16) / PAGE_W));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const blocks = !data ? [] : mode === "naskah"
    ? data.soal.map((soal) => <SoalBlock key={soal.soal_id} soal={soal} />)
    : data.soal.length ? [<KunciRingkasBlock key="ringkas" soal={data.soal} />, ...data.soal.map((soal) => <PembahasanBlock key={soal.soal_id} soal={soal} />)] : [];

  // Ukur tinggi tiap blok di wadah tersembunyi, lalu susun halaman. Diulang
  // saat ukuran berubah (rumus KaTeX dirender, gambar selesai dimuat).
  useEffect(() => {
    const el = measureRef.current;
    if (!el || !data) return;
    setPages(null);
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const heights = Array.from(el.children).map((child) => (child as HTMLElement).offsetHeight);
        const next = paginate(heights);
        setPages((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [data, mode]);

  const kembali = () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  };

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>;
  if (!data) return <p className="p-8 text-center text-gray-500">Menyiapkan dokumen…</p>;

  return (
    <div className="cetak-root">
      <div className="cetak-bar">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={kembali} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-white/90 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
            </button>
            <h1 className="min-w-0 truncate text-base font-bold text-white sm:text-lg">{judul}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-white/15 p-1" role="tablist" aria-label="Isi dokumen">
              {([["naskah", "Naskah soal"], ["kunci", "Kunci & pembahasan"]] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === value ? "bg-white text-[#2d3c8f]" : "text-white/90 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} disabled={!pages || data.soal.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2d3c8f] shadow disabled:opacity-60">
              <Download className="h-4 w-4" aria-hidden="true" /> Unduh PDF
            </button>
          </div>
          <p className="text-xs text-white/75">Unduh PDF membuka dialog cetak. Pilih <b>Simpan sebagai PDF</b> sebagai tujuan.</p>
        </div>
      </div>

      {/* Wadah ukur: lebar sama dengan area isi lembar, tidak terlihat. */}
      <div ref={measureRef} className="cetak-measure cetak-content" aria-hidden="true">
        {blocks.map((block, i) => <div key={i}>{block}</div>)}
      </div>

      <div className="cetak-stage">
        {data.soal.length === 0 ? (
          <p className="py-10 text-center text-gray-500">Belum ada soal pada set ini.</p>
        ) : !pages ? (
          <p className="py-10 text-center text-gray-500">Menyusun halaman…</p>
        ) : (
          <div className="cetak-pages" style={{ zoom }}>
            {pages.map((indexes, pageIndex) => (
              <Lembar key={pageIndex} data={data} halaman={pageIndex + 1} total={pages.length}>
                <div className="cetak-content">
                  {indexes.map((index, i) => <div key={index} style={{ marginTop: i ? GAP : 0 }}>{blocks[index]}</div>)}
                </div>
              </Lembar>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @page { size: A4; margin: 0; }
        .cetak-root { min-height: 100vh; background: #e9ebf1; }
        .cetak-bar { position: sticky; top: 0; z-index: 10; background: #2d3c8f; box-shadow: 0 2px 10px rgba(15, 23, 42, .25); }
        .cetak-stage { padding: 16px 8px 32px; }
        .cetak-pages { display: flex; flex-direction: column; align-items: safe center; gap: 20px; }
        .cetak-sheet { position: relative; width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden; background: #fff; box-shadow: 0 4px 18px rgba(15, 23, 42, .12); padding: ${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px; display: flex; flex-direction: column; }
        .cetak-head { height: ${HEAD_H}px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 4px double #3b4a9c; margin-bottom: 20px; padding-bottom: 8px; }
        .cetak-body { position: relative; flex: 1; min-height: 0; }
        .cetak-foot { height: ${FOOT_H}px; flex-shrink: 0; display: flex; align-items: flex-end; justify-content: center; border-top: 1px solid #e5e7eb; font: 500 11px/1 ui-sans-serif, system-ui, sans-serif; color: #6b7280; padding-bottom: 4px; }
        .cetak-content { font-family: "Noto Serif", Georgia, Cambria, "Times New Roman", serif; font-size: 14.5px; line-height: 1.6; color: #111827; }
        .cetak-content img { max-width: 100%; max-height: 380px; height: auto; }
        .cetak-content table { max-width: 100%; }
        .cetak-measure { position: absolute; left: -10000px; top: 0; width: ${CONTENT_W}px; visibility: hidden; pointer-events: none; }
        .cetak-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 18px; opacity: .07; transform: rotate(40deg); pointer-events: none; }
        .cetak-watermark img { width: 200px; height: 200px; object-fit: contain; }
        .cetak-watermark span { font: 900 italic 64px/0.95 ui-sans-serif, system-ui, sans-serif; color: #2d3c8f; letter-spacing: .02em; }
        @media print {
          html, body, .cetak-root { background: #fff !important; }
          .cetak-bar, .cetak-measure { display: none !important; }
          .cetak-stage { padding: 0; }
          .cetak-pages { zoom: 1 !important; gap: 0; display: block; }
          .cetak-sheet { width: 210mm; height: 297mm; box-shadow: none; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cetak-sheet:last-child { break-after: auto; }
        }
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
