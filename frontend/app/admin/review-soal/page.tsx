"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, ShieldCheck, XCircle } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import MathContent from "@/components/MathContent";
import Skeleton from "@/components/Skeleton";
import Textarea from "@/components/Textarea";
import { api, getErrorMessage } from "@/lib/api";
import { Soal, OpsiJawabanAdmin, Pelajaran, PernyataanBenarSalahAdmin } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

type PreviewQuestion = Omit<Soal, "pernyataan"> & { pernyataan?: PernyataanBenarSalahAdmin[] };

type QuestionPreviewProps = {
  question: PreviewQuestion;
  options: OpsiJawabanAdmin[];
  selectedOption: number | null;
  selectedOptions: number[];
  statementAnswers: Record<number, boolean>;
  textAnswer: string;
  onOptionChange: (id: number) => void;
  onMultiChange: (id: number) => void;
  onStatementChange: (id: number, value: boolean) => void;
  onTextChange: (value: string) => void;
  onReset: () => void;
};

function QuestionPreview({ question, options, selectedOption, selectedOptions, statementAnswers, textAnswer, onOptionChange, onMultiChange, onStatementChange, onTextChange, onReset }: QuestionPreviewProps) {
  const statements = question.pernyataan ?? [];
  const hasAnswer = selectedOption !== null || selectedOptions.length > 0 || Object.keys(statementAnswers).length > 0 || textAnswer.length > 0;
  const isMulti = question.tipe === "pilihan_lebih_dari_satu";
  const isCompound = question.tipe === "benar_salah" && statements.length > 0;

  return (
    <div className="rounded-card border border-brand-primary/20 bg-card-bg p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-primary">Preview tampilan siswa</p>
        {hasAnswer && <button type="button" onClick={onReset} className="text-xs font-semibold text-brand-primary underline underline-offset-2">Reset jawaban preview</button>}
      </div>
      <MathContent className="prose max-w-none text-body-dark prose-p:text-body-dark prose-li:text-body-dark" html={question.teks_soal} />
      <div className="mt-5">
        {question.tipe === "esai" ? (
          <label className="block text-sm font-semibold text-body-dark">Jawaban Esai<textarea value={textAnswer} onChange={(e) => onTextChange(e.target.value)} rows={7} placeholder="Tulis jawaban kamu di sini..." className="mt-2 w-full rounded-input border border-card-border bg-card-bg p-3 font-normal text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" /></label>
        ) : question.tipe === "isian" ? (
          <label className="block text-sm font-semibold text-body-dark">Jawaban Singkat<input value={textAnswer} onChange={(e) => onTextChange(e.target.value)} type="text" placeholder="Tulis jawaban singkat kamu di sini..." className="mt-2 w-full rounded-input border border-card-border bg-card-bg p-3 font-normal text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" /></label>
        ) : isCompound ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[28rem] border-collapse text-sm"><thead><tr><th className="border-b border-card-border px-3 py-2 text-left">Pernyataan</th><th className="border-b border-card-border px-3 py-2">{question.label_benar || "Benar"}</th><th className="border-b border-card-border px-3 py-2">{question.label_salah || "Salah"}</th></tr></thead><tbody>{statements.map((statement, index) => <tr key={statement.id ?? index}><td className="border-b border-card-border px-3 py-3"><MathContent className="prose prose-sm max-w-none" html={statement.teks_pernyataan} /></td>{[true, false].map((value) => <td key={String(value)} className="border-b border-card-border px-3 py-3 text-center"><input type="radio" name={`preview-statement-${question.id}-${statement.id ?? index}`} checked={statementAnswers[statement.id] === value} onChange={() => onStatementChange(statement.id, value)} aria-label={`${value ? question.label_benar || "Benar" : question.label_salah || "Salah"} untuk pernyataan ${index + 1}`} /></td>)}</tr>)}</tbody></table></div>
        ) : (
          <fieldset className="space-y-2"><legend className="sr-only">Pilihan jawaban</legend>{options.map((option, index) => { const checked = isMulti ? selectedOptions.includes(option.id) : selectedOption === option.id; return <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-input border p-3 transition ${checked ? "border-brand-primary bg-brand-primary/5" : "border-card-border hover:border-brand-primary/60"}`}><input type={isMulti ? "checkbox" : "radio"} name={`preview-option-${question.id}`} checked={checked} onChange={() => isMulti ? onMultiChange(option.id) : onOptionChange(option.id)} className="mt-1 h-4 w-4 accent-brand-primary" /><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-card-border bg-neutral text-xs font-bold">{String.fromCharCode(65 + index)}</span><MathContent className="prose prose-sm max-w-none flex-1" html={option.teks_opsi} /></label>; })}</fieldset>
        )}
      </div>
    </div>
  );
}

export default function ReviewSoalPage() {
  const [items, setItems] = useState<Soal[]>([]);
  const [selected, setSelected] = useState<PreviewQuestion | null>(null);
  const [selectedOpsi, setSelectedOpsi] = useState<OpsiJawabanAdmin[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [statementAnswers, setStatementAnswers] = useState<Record<number, boolean>>({});
  const [textAnswer, setTextAnswer] = useState("");
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [selectedGuru, setSelectedGuru] = useState<string | null>(null);
  const [selectedMapel, setSelectedMapel] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = async () => { setLoading(true); try { const [response, pelajaranResponse] = await Promise.all([api.get("/soal/", { params: { status_filter: "pending_review" } }), api.get("/pelajaran/")]); setItems(response.data ?? []); setPelajaranList(pelajaranResponse.data ?? []); } catch (err) { setError(getErrorMessage(err, "Antrean review belum bisa dimuat.")); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const selectQuestion = async (item: Soal) => {
    const currentRequest = ++requestIdRef.current;
    setSelected({ ...item, pernyataan: undefined }); setSelectedOpsi([]); setNote(""); setDetailError(""); setDetailLoading(true); setSelectedOption(null); setSelectedOptions([]); setStatementAnswers({}); setTextAnswer("");
    try {
      const [detailResponse, optionsResponse] = await Promise.all([api.get(`/soal/${item.id}`), api.get(`/soal/${item.id}/opsi`)]);
      if (currentRequest !== requestIdRef.current) return;
      setSelected(detailResponse.data ?? { ...item, pernyataan: undefined });
      setSelectedOpsi(optionsResponse.data ?? detailResponse.data?.opsi_jawaban ?? []);
    } catch (err) { if (currentRequest === requestIdRef.current) setDetailError(getErrorMessage(err, "Detail soal belum bisa dimuat.")); } finally { if (currentRequest === requestIdRef.current) setDetailLoading(false); }
  };

  const guruGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: Soal[] }>();
    items.forEach((item) => { const key = String(item.created_by ?? "none"); const group = groups.get(key) ?? { label: item.created_by_name || (item.created_by != null ? `User #${item.created_by}` : "Tanpa Pembuat"), items: [] }; group.items.push(item); groups.set(key, group); });
    return Array.from(groups.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [items]);
  const activeGuru = guruGroups.find(([key]) => key === selectedGuru) ?? null;
  const mapelGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: Soal[] }>();
    (activeGuru?.[1].items ?? []).forEach((item) => { const key = String(item.pelajaran_id ?? "none"); const group = groups.get(key) ?? { label: pelajaranList.find((p) => p.id === item.pelajaran_id)?.nama || "Tanpa Mata Pelajaran", items: [] }; group.items.push(item); groups.set(key, group); });
    return Array.from(groups.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [activeGuru, pelajaranList]);
  const activeMapel = activeGuru ? mapelGroups.find(([key]) => key === selectedMapel) ?? null : null;
  const level: "guru" | "mapel" | "soal" = !activeGuru ? "guru" : !activeMapel ? "mapel" : "soal";
  const resetGrouping = () => { setSelectedGuru(null); setSelectedMapel(null); };
  const goBack = () => { if (level === "soal") setSelectedMapel(null); else resetGrouping(); };
  const groupButton = (key: string, label: string, count: number, onClick: () => void) => <button key={key} type="button" onClick={onClick} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="font-semibold text-heading-dark">{label}</span><ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-hover:text-brand-primary" aria-hidden="true" /></div><span className="mt-3 text-xs text-text-muted">{count} soal menunggu review</span></button>;

  const resetPreview = () => { setSelectedOption(null); setSelectedOptions([]); setStatementAnswers({}); setTextAnswer(""); };
  const review = async (action: "approve" | "reject") => { if (!selected) return; if (action === "reject" && note.trim().length < 3) { setError("Catatan penolakan minimal 3 karakter."); return; } setBusy(true); setError(""); try { await api.post(`/soal/${selected.id}/${action}`, { note: note.trim() || null }); setSelected(null); setSelectedOpsi([]); setNote(""); await load(); } catch (err) { setError(getErrorMessage(err, "Review soal gagal diproses.")); } finally { setBusy(false); } };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-brand-primary">Quality control</p><h1 className="mt-1 text-3xl font-bold text-heading-dark">Review Soal</h1><p className="mt-1 text-sm text-text-muted">Periksa konten guru sebelum diterbitkan ke bank soal bersama.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{items.length} menunggu review</span></header>
    {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div> : items.length === 0 ? <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Tidak ada antrean review" description="Semua pengajuan soal guru sudah ditangani." /> : <Card><div className="space-y-4">
      {level !== "guru" && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-3"><button type="button" onClick={goBack} className="flex items-center gap-2 rounded-btn px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali</button><div className="text-right"><div className="text-sm font-bold text-heading-dark">{activeGuru?.[1].label}</div><div className="text-xs text-text-muted">{level === "mapel" ? "Mata Pelajaran" : "Daftar Soal"}</div></div></div>}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-text-muted"><button type="button" onClick={resetGrouping} className="font-semibold text-brand-primary hover:underline">Guru</button>{activeGuru && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><button type="button" onClick={() => setSelectedMapel(null)} className={activeMapel ? "font-semibold text-brand-primary hover:underline" : ""}>{activeGuru[1].label}</button></>}{activeMapel && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{activeMapel[1].label}</span></>}</nav>
      {level === "guru" && <div className="grid max-h-[440px] gap-3 overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3 sm:grid-cols-2 lg:grid-cols-3">{guruGroups.map(([key, group]) => groupButton(key, group.label, group.items.length, () => { setSelectedGuru(key); setSelectedMapel(null); }))}</div>}
      {level === "mapel" && <div className="grid max-h-[440px] gap-3 overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3 sm:grid-cols-2 lg:grid-cols-3">{mapelGroups.map(([key, group]) => groupButton(key, group.label, group.items.length, () => setSelectedMapel(key)))}</div>}
      {level === "soal" && <div className="grid max-h-[560px] gap-4 overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3 lg:grid-cols-2">{(activeMapel?.[1].items ?? []).map((item) => <Card key={item.id}><div className="flex items-start justify-between gap-3"><div className="text-xs text-text-muted">#{item.id} · {labelTipeSoal(item.tipe)} · <span className="capitalize">{item.tingkat_kesulitan}</span></div><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Menunggu Review</span></div><p className="mt-2 text-sm font-semibold text-brand-primary">Dibuat oleh: {item.created_by_name || `User #${item.created_by ?? "-"}`}</p><MathContent className="prose prose-sm mt-4 max-w-none line-clamp-5" html={item.teks_soal} /><div className="mt-5 border-t border-card-border pt-4"><Button size="sm" onClick={() => void selectQuestion(item)}>Periksa Soal</Button></div></Card>)}</div>}
    </div></Card>}
    {selected && <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4" role="dialog" aria-modal="true"><div className="my-8 w-full max-w-3xl rounded-modal border border-card-border bg-card-bg shadow-modal"><div className="flex items-center justify-between border-b border-card-border px-5 py-4"><div><h2 className="text-lg font-bold text-heading-dark">Review Soal #{selected.id}</h2><p className="text-sm text-text-muted">{labelTipeSoal(selected.tipe)} · <span className="capitalize">{selected.tingkat_kesulitan}</span> · Dibuat oleh <span className="font-semibold text-brand-primary">{selected.created_by_name || `User #${selected.created_by ?? "-"}`}</span></p></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup review" className="rounded-lg px-2 py-1 text-xl text-text-muted hover:bg-neutral">×</button></div><div className="space-y-5 p-5">{detailLoading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div> : detailError ? <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{detailError}</div> : <><QuestionPreview question={selected} options={selectedOpsi} selectedOption={selectedOption} selectedOptions={selectedOptions} statementAnswers={statementAnswers} textAnswer={textAnswer} onOptionChange={setSelectedOption} onMultiChange={(id) => setSelectedOptions((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} onStatementChange={(id, value) => setStatementAnswers((current) => ({ ...current, [id]: value }))} onTextChange={setTextAnswer} onReset={resetPreview} /><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Kunci/Pedoman untuk reviewer</p>{selectedOpsi.length > 0 && <div className="space-y-2">{selectedOpsi.map((opsi, index) => <div key={opsi.id} className="flex items-start gap-3 rounded-input border border-card-border bg-neutral p-3"><span className="font-bold">{String.fromCharCode(65 + index)}.</span><MathContent className="prose prose-sm max-w-none" html={opsi.teks_opsi} /><span className="ml-auto shrink-0 text-xs font-semibold text-green-700">{opsi.is_benar ? "Kunci" : ""}</span></div>)}</div>}{selected.pernyataan?.length ? <div className="mt-3 space-y-2">{selected.pernyataan.map((row) => <div key={row.id} className="flex items-start justify-between gap-3 rounded-input border border-card-border bg-neutral p-3"><MathContent className="prose prose-sm max-w-none" html={row.teks_pernyataan} /><span className="shrink-0 text-xs font-semibold text-green-700">{row.is_benar ? selected.label_benar || "Benar" : selected.label_salah || "Salah"}</span></div>)}</div> : null}{selected.kunci_jawaban && <MathContent className="prose prose-sm mt-3 max-w-none rounded-input border border-green-300 bg-green-50 p-3" html={selected.kunci_jawaban} />}{selected.pembahasan && <div className="mt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Pembahasan</p><MathContent className="prose prose-sm max-w-none rounded-input border border-card-border p-4" html={selected.pembahasan} /></div>}</div></>}<Textarea label="Catatan Review" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wajib diisi bila soal ditolak" /></div><div className="flex flex-wrap justify-end gap-3 border-t border-card-border px-5 py-4"><Button variant="outline" onClick={() => setSelected(null)}>Batal</Button><Button variant="danger" disabled={busy} onClick={() => void review("reject")}><XCircle className="mr-1 h-4 w-4" /> Tolak</Button><Button disabled={busy} onClick={() => void review("approve")}><CheckCircle2 className="mr-1 h-4 w-4" /> Setujui & Terbitkan</Button></div></div></div>}
  </div>;
}
