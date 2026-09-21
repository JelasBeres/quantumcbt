"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, FileQuestion, XCircle } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import MathContent from "@/components/MathContent";
import Textarea from "@/components/Textarea";
import { api, getErrorMessage } from "@/lib/api";
import { JadwalUjian, Kelas, PaketUjian, Program, Soal } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

type SoalPaket = Soal & {
  kunci_jawaban?: string | null;
  pembahasan?: string | null;
  opsi_jawaban?: Array<{
    id: number;
    teks_opsi: string;
    is_benar: boolean;
    urutan?: number | null;
  }>;
};

export default function ReviewJadwalPage() {
  const [items, setItems] = useState<JadwalUjian[]>([]);
  const [paket, setPaket] = useState<PaketUjian[]>([]);
  const [program, setProgram] = useState<Program[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [selected, setSelected] = useState<JadwalUjian | null>(null);
  const [soalPaket, setSoalPaket] = useState<SoalPaket[]>([]);
  const [loadingSoal, setLoadingSoal] = useState(false);
  const [soalError, setSoalError] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [jadwalRes, paketRes, programRes, kelasRes] = await Promise.all([
        api.get("/jadwal-ujian"),
        api.get("/paket-ujian"),
        api.get("/program/"),
        api.get("/kelas/")
      ]);
      setItems((jadwalRes.data ?? []).filter((item: JadwalUjian) => item.status === "pending_review"));
      setPaket(paketRes.data ?? []);
      setProgram(programRes.data ?? []);
      setKelas(kelasRes.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Antrean jadwal gagal dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openReview = async (item: JadwalUjian) => {
    setSelected(item);
    setNote("");
    setSoalPaket([]);
    setSoalError("");
    setLoadingSoal(true);
    try {
      const response = await api.get(`/paket-ujian/${item.paket_ujian_id}/review-soal`);
      setSoalPaket(response.data ?? []);
    } catch (err) {
      setSoalError(getErrorMessage(err, "Daftar soal paket gagal dimuat."));
    } finally {
      setLoadingSoal(false);
    }
  };

  const closeReview = () => {
    setSelected(null);
    setSoalPaket([]);
    setSoalError("");
    setNote("");
  };

  const process = async (action: "approve" | "reject") => {
    if (!selected) return;
    if (action === "reject" && note.trim().length < 3) {
      setError("Catatan penolakan minimal 3 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post(`/jadwal-ujian/${selected.id}/${action}`, { note: note.trim() || null });
      closeReview();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Review jadwal gagal diproses."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Kontrol publikasi</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Review Jadwal</h1>
          <p className="mt-1 text-sm text-text-muted">Periksa target, waktu, dan isi soal sebelum jadwal diterbitkan ke siswa.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{items.length} menunggu review</span>
      </header>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3"><div className="h-24 animate-pulse rounded-card bg-neutral" /><div className="h-24 animate-pulse rounded-card bg-neutral" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Tidak ada antrean jadwal" description="Semua pengajuan jadwal guru sudah ditangani." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const paketItem = paket.find((entry) => entry.id === item.paket_ujian_id);
            const programName = program.find((entry) => entry.id === item.program_id)?.nama || "Semua program";
            const kelasName = kelas.find((entry) => entry.id === item.kelas_id)?.nama || "Semua kelas";
            return (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-heading-dark">{paketItem?.nama || `Paket #${item.paket_ujian_id}`}</h3>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Menunggu Review</span>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{new Date(item.mulai).toLocaleString("id-ID")} - {new Date(item.selesai).toLocaleString("id-ID")}</p>
                    <p className="mt-1 text-xs text-text-muted">{programName} · {kelasName} · {paketItem?.jumlah_soal ?? 0} soal</p>
                  </div>
                  <Button size="sm" onClick={() => void openReview(item)}>Periksa Jadwal</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4" role="dialog" aria-modal="true">
          <div className="my-8 w-full max-w-4xl rounded-modal border border-card-border bg-card-bg shadow-modal">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-heading-dark">Review Jadwal</h2>
                <p className="text-sm text-text-muted">{paket.find((entry) => entry.id === selected.paket_ujian_id)?.nama}</p>
              </div>
              <button type="button" onClick={closeReview} className="rounded-lg px-2 py-1 text-xl text-text-muted hover:bg-neutral" aria-label="Tutup">×</button>
            </div>

            <div className="space-y-5 p-5">
              <dl className="grid gap-3 rounded-input border border-card-border p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-text-muted">Mulai</dt><dd className="font-semibold text-heading-dark">{new Date(selected.mulai).toLocaleString("id-ID")}</dd></div>
                <div><dt className="text-text-muted">Selesai</dt><dd className="font-semibold text-heading-dark">{new Date(selected.selesai).toLocaleString("id-ID")}</dd></div>
                <div><dt className="text-text-muted">Program</dt><dd className="font-semibold text-heading-dark">{program.find((entry) => entry.id === selected.program_id)?.nama || "Semua program"}</dd></div>
                <div><dt className="text-text-muted">Kelas</dt><dd className="font-semibold text-heading-dark">{kelas.find((entry) => entry.id === selected.kelas_id)?.nama || "Semua kelas"}</dd></div>
              </dl>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-heading-dark">Soal dalam Paket</h3>
                    <p className="text-xs text-text-muted">Tampilan hanya-baca untuk memastikan soal yang dimasukkan guru.</p>
                  </div>
                  {!loadingSoal && <span className="rounded-full bg-neutral px-3 py-1 text-xs font-semibold text-body-dark">{soalPaket.length} soal</span>}
                </div>

                {loadingSoal ? (
                  <div className="rounded-input border border-card-border p-6 text-center text-sm text-text-muted">Memuat soal paket...</div>
                ) : soalError ? (
                  <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{soalError}</div>
                ) : soalPaket.length === 0 ? (
                  <div className="rounded-input border border-card-border p-6 text-center text-sm text-text-muted">
                    <FileQuestion className="mx-auto mb-2 h-6 w-6" />
                    Paket ini belum memiliki soal.
                  </div>
                ) : (
                  <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                    {soalPaket.map((soal, index) => (
                      <article key={soal.id} className="rounded-input border border-card-border bg-neutral p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-heading-dark">Soal {index + 1}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                            <span>{labelTipeSoal(soal.tipe)}</span>
                            <span>·</span>
                            <span className="capitalize">{soal.tingkat_kesulitan ?? "sedang"}</span>
                          </div>
                        </div>
                        <MathContent className="prose prose-sm max-w-none text-body-dark" html={soal.teks_soal} />
                        {soal.gambar_url && <img src={soal.gambar_url} alt={`Gambar soal ${index + 1}`} className="mt-3 max-h-64 rounded-input border border-card-border object-contain" />}
                        {soal.kunci_jawaban && (soal.tipe === "esai" || soal.tipe === "isian") && (
                          <div className="mt-4 rounded-input border border-green-300 bg-green-50 p-3">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">Jawaban benar / pedoman</p>
                            <MathContent className="prose prose-sm max-w-none text-green-900" html={soal.kunci_jawaban} />
                          </div>
                        )}
                        {soal.pembahasan && (
                          <div className="mt-4 rounded-input border border-blue-200 bg-blue-50 p-3">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">Pembahasan inti</p>
                            <MathContent className="prose prose-sm max-w-none text-blue-900" html={soal.pembahasan} />
                          </div>
                        )}
                        {soal.opsi_jawaban && soal.opsi_jawaban.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {soal.opsi_jawaban.map((opsi, opsiIndex) => (
                              <div key={opsi.id} className={`flex items-start gap-2 rounded-input border p-3 ${opsi.is_benar ? "border-green-300 bg-green-50" : "border-card-border bg-card-bg"}`}>
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${opsi.is_benar ? "border-green-500 bg-green-500 text-white" : "border-card-border text-body-dark"}`}>{String.fromCharCode(65 + opsiIndex)}</span>
                                <div className="min-w-0 flex-1">
                                  <MathContent className="prose prose-sm max-w-none" html={opsi.teks_opsi} />
                                  {opsi.is_benar && <p className="mt-1 text-xs font-bold text-green-700">Kunci jawaban</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <Textarea label="Catatan Review" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Wajib untuk penolakan" />
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-card-border px-5 py-4">
              <Button variant="outline" onClick={closeReview}>Batal</Button>
              <Button variant="danger" disabled={busy} onClick={() => process("reject")}><XCircle className="mr-1 h-4 w-4" /> Tolak</Button>
              <Button disabled={busy} onClick={() => process("approve")}><CheckCircle2 className="mr-1 h-4 w-4" /> Setujui & Terbitkan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
