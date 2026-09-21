"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import MathContent from "@/components/MathContent";
import Skeleton from "@/components/Skeleton";
import Textarea from "@/components/Textarea";
import { api, getErrorMessage } from "@/lib/api";
import { Soal, OpsiJawabanAdmin } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

export default function ReviewSoalPage() {
  const [items, setItems] = useState<Soal[]>([]);
  const [selected, setSelected] = useState<Soal | null>(null);
  const [selectedOpsi, setSelectedOpsi] = useState<OpsiJawabanAdmin[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/soal/", { params: { status_filter: "pending_review" } });
      setItems(response.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Antrean review belum bisa dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const loadOpsi = async (soalId: number) => {
    try {
      const res = await api.get(`/soal/${soalId}/opsi`);
      setSelectedOpsi(res.data ?? []);
    } catch {
      setSelectedOpsi([]);
    }
  };

  const review = async (action: "approve" | "reject") => {
    if (!selected) return;
    if (action === "reject" && note.trim().length < 3) {
      setError("Catatan penolakan minimal 3 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post(`/soal/${selected.id}/${action}`, { note: note.trim() || null });
      setSelected(null);
      setSelectedOpsi([]);
      setNote("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Review soal gagal diproses."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Quality control</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Review Soal</h1>
          <p className="mt-1 text-sm text-text-muted">Periksa konten guru sebelum diterbitkan ke bank soal bersama.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{items.length} menunggu review</span>
      </header>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Tidak ada antrean review" description="Semua pengajuan soal guru sudah ditangani." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
               <div className="flex items-start justify-between gap-3"><div className="text-xs text-text-muted">#{item.id} · {labelTipeSoal(item.tipe)} · <span className="capitalize">{item.tingkat_kesulitan}</span></div><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Menunggu Review</span></div>
               <p className="mt-2 text-sm font-semibold text-brand-primary">Dibuat oleh: {item.created_by_name || `User #${item.created_by ?? "-"}`}</p>
              <MathContent className="prose prose-sm mt-4 max-w-none line-clamp-5" html={item.teks_soal} />
              <div className="mt-5 border-t border-card-border pt-4"><Button size="sm" onClick={() => { setSelected(item); setSelectedOpsi([]); setNote(""); void loadOpsi(item.id); }}>Periksa Soal</Button></div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4" role="dialog" aria-modal="true">
          <div className="my-8 w-full max-w-3xl rounded-modal border border-card-border bg-card-bg shadow-modal">
             <div className="flex items-center justify-between border-b border-card-border px-5 py-4"><div><h2 className="text-lg font-bold text-heading-dark">Review Soal #{selected.id}</h2><p className="text-sm text-text-muted">{labelTipeSoal(selected.tipe)} · <span className="capitalize">{selected.tingkat_kesulitan}</span> · Dibuat oleh <span className="font-semibold text-brand-primary">{selected.created_by_name || `User #${selected.created_by ?? "-"}`}</span></p></div><button onClick={() => setSelected(null)} className="rounded-lg px-2 py-1 text-xl text-text-muted hover:bg-neutral">×</button></div>
            <div className="space-y-5 p-5">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Pertanyaan</p><MathContent className="prose max-w-none rounded-input border border-card-border p-4" html={selected.teks_soal} /></div>
               {selectedOpsi.length > 0 && (
                 <div>
                   <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Pilihan Jawaban &amp; Kunci</p>
                   <div className="space-y-2">
                     {selectedOpsi.map((opsi, index) => (
                       <div key={opsi.id} className={`flex items-start gap-3 rounded-input border p-3 ${opsi.is_benar ? "border-green-300 bg-green-50" : "border-card-border bg-neutral"}`}>
                         <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${opsi.is_benar ? "bg-green-600 text-white" : "border border-card-border bg-card-bg text-body-dark"}`}>{String.fromCharCode(65 + index)}</span>
                         <div className="min-w-0 flex-1">
                           <MathContent className="prose prose-sm max-w-none" html={opsi.teks_opsi} />
                           {opsi.is_benar && <p className="mt-1 text-xs font-bold text-green-700">Kunci jawaban</p>}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               {selected.kunci_jawaban && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Jawaban Benar / Pedoman</p><MathContent className="prose prose-sm max-w-none rounded-input border border-green-300 bg-green-50 p-3" html={selected.kunci_jawaban} /></div>}
              {selected.pembahasan && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Pembahasan</p><MathContent className="prose prose-sm max-w-none rounded-input border border-card-border p-4" html={selected.pembahasan} /></div>}
              <Textarea label="Catatan Review" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wajib diisi bila soal ditolak" />
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-card-border px-5 py-4"><Button variant="outline" onClick={() => setSelected(null)}>Batal</Button><Button variant="danger" disabled={busy} onClick={() => review("reject")}><XCircle className="mr-1 h-4 w-4" /> Tolak</Button><Button disabled={busy} onClick={() => review("approve")}><CheckCircle2 className="mr-1 h-4 w-4" /> Setujui & Terbitkan</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
