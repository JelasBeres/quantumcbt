"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import MathContent from "@/components/MathContent";
import Textarea from "@/components/Textarea";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { labelBagianStatus, toneBagianStatus } from "@/lib/bagian-status";
import { BagianPaket, PaketUjian, Pelajaran, Soal, Topik } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";
import { ArrowDown, ArrowUp, CheckCircle2, FileDown, Pencil, Trash2, MoreVertical, Clock, Send, Eye } from "lucide-react";

const LAPORAN_SOAL_PRESET = [
  "Soal tidak sesuai mapel",
  "Tingkat kesulitan tidak sesuai",
  "Soal duplikat",
  "Soal harus diganti",
  "Komposisi tipe soal perlu diperbaiki",
];

type Props = {
  paket: PaketUjian;
  bagianList: BagianPaket[];
  pelajaranList: Pelajaran[];
  topikList: Topik[];
  isGuru: boolean;
  emptyText: string;
  onChanged: () => Promise<void>;
  onEdit: (bagian: BagianPaket) => void;
};

// Kartu set soal (bagian) beserta aksinya: guru isi soal/durasi/ajukan review,
// admin periksa/setujui/minta revisi, edit, dan hapus.
export default function BagianSetCards({
  paket,
  bagianList,
  pelajaranList,
  topikList,
  isGuru,
  emptyText,
  onChanged,
  onEdit,
}: Props) {
  const router = useRouter();
  const { showAlert, showConfirm, showPrompt, dialog } = useAppDialog();
  const [bagianPicker, setBagianPicker] = useState<BagianPaket | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [bagianQuestions, setBagianQuestions] = useState<Soal[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  // Unduh set soal: halaman cetak punya tab Naskah soal / Kunci & pembahasan sendiri.
  const bukaEkspor = (bagian: BagianPaket) => {
    window.open(`/cetak/set-soal?paket=${paket.id}&bagian=${bagian.id}`, "_blank");
  };

  const getNama = <T extends { id: number; nama: string }>(
    list: T[],
    id?: number | null,
  ) => (id ? (list.find((item) => item.id === id)?.nama ?? "-") : "-");

  const deleteBagian = async (bagian: BagianPaket) => {
    if (
      !(await showConfirm({
        title: "Hapus Bagian Paket",
        description: `Bagian \"${bagian.nama}\" beserta soal di dalamnya akan dihapus.`,
        confirmLabel: "Hapus Bagian",
        confirmVariant: "danger",
      }))
    )
      return;
    try {
      await api.delete(`/paket-ujian/${paket.id}/bagian/${bagian.id}`);
      await onChanged();
    } catch (error) {
      await showAlert({
        title: "Gagal Menghapus Bagian",
        description: getErrorMessage(error, "Bagian gagal dihapus."),
      });
    }
  };

  const updateBagianDuration = async (bagian: BagianPaket) => {
    const value = await showPrompt({
      title: `Atur Durasi — ${bagian.nama}`,
      description: "Isi durasi bagian dalam menit (1-1440).",
      inputLabel: "Menit",
      required: true,
    });
    if (value === null) return;
    try {
      await api.patch(`/paket-ujian/${paket.id}/bagian/${bagian.id}/durasi`, {
        durasi_menit: Number(value),
      });
      await onChanged();
    } catch (error) {
      await showAlert({
        title: "Durasi gagal disimpan",
        description: getErrorMessage(error, "Durasi harus 1 sampai 1440 menit."),
      });
    }
  };

  const submitBagianReview = async (bagian: BagianPaket) => {
    try {
      await api.post(`/paket-ujian/${paket.id}/bagian/${bagian.id}/submit-review`, {});
      await onChanged();
    } catch (error) {
      await showAlert({
        title: "Gagal Mengajukan Review",
        description: getErrorMessage(
          error,
          "Pastikan durasi & soal bagian sudah diisi, dan semua soal berstatus approved.",
        ),
      });
    }
  };

  const openIsiSoal = (bagian: BagianPaket) => {
    const tipe = paket.tipe === "latihan" ? "latihan" : "ujian";
    const kategoriId = paket.kategori_id == null ? "belum" : String(paket.kategori_id);
    router.push(`/${isGuru ? "guru" : "admin"}/paket-ujian/isi-soal?id=${paket.id}&bagian_id=${bagian.id}&tipe=${tipe}&kategori_id=${encodeURIComponent(kategoriId)}`);
  };

  const moveBagian = async (bagian: BagianPaket, direction: -1 | 1) => {
    const ordered = [...bagianList].sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    const index = ordered.findIndex((item) => item.id === bagian.id);
    const target = ordered[index + direction];
    if (!target) return;
    try {
      await Promise.all([
        api.put(`/paket-ujian/${paket.id}/bagian/${bagian.id}`, { urutan: target.urutan, wajib: bagian.wajib }),
        api.put(`/paket-ujian/${paket.id}/bagian/${target.id}`, { urutan: bagian.urutan, wajib: target.wajib }),
      ]);
      await onChanged();
    } catch (error) {
      await showAlert({ title: "Urutan gagal diubah", description: getErrorMessage(error, "Urutan mapel gagal diubah.") });
    }
  };

  const openBagianPicker = async (bagian: BagianPaket) => {
    if (isGuru) {
      openIsiSoal(bagian);
      return;
    }
    setBagianPicker(bagian);
    setBagianQuestions([]);
    setReviewNote("");
    setReviewError("");
    try {
      const details = await Promise.all(
        (bagian.soal_ids ?? []).map((soalId) => api.get(`/soal/${soalId}`)),
      );
      setBagianQuestions(details.map(({ data }) => data));
    } catch {
      setBagianQuestions([]);
    }
  };

  const approveBagian = async () => {
    if (!bagianPicker) return;
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await api.post(`/paket-ujian/${paket.id}/bagian/${bagianPicker.id}/setujui`, {
        note: reviewNote.trim() || undefined,
      });
      setBagianPicker(null);
      await onChanged();
    } catch (error) {
      setReviewError(getErrorMessage(error, "Gagal menyetujui bagian."));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const requestBagianRevision = async () => {
    if (!bagianPicker) return;
    if (reviewNote.trim().length < 3) {
      setReviewError("Alasan revisi wajib diisi (minimal 3 karakter).");
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await api.post(`/paket-ujian/${paket.id}/bagian/${bagianPicker.id}/minta-revisi`, {
        note: reviewNote.trim(),
      });
      setBagianPicker(null);
      await onChanged();
    } catch (error) {
      setReviewError(getErrorMessage(error, "Gagal meminta revisi."));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const flagSoal = async (soal: Soal) => {
    const preset = await showPrompt({
      title: `Laporkan Soal #${soal.id}`,
      description: `Alasan umum: ${LAPORAN_SOAL_PRESET.join(", ")}. Bisa juga tulis alasan lain.`,
      inputLabel: "Alasan laporan",
      required: true,
      minLength: 3,
    });
    if (!preset) return;
    try {
      await api.post("/laporan-soal/", { soal_id: soal.id, alasan: preset });
      await showAlert({
        title: "Laporan terkirim",
        description: "Soal ini akan muncul di antrean Laporan Soal.",
      });
    } catch (error) {
      await showAlert({
        title: "Gagal melaporkan soal",
        description: getErrorMessage(error, "Laporan soal gagal dikirim."),
      });
    }
  };

  return (
    <>
      {bagianList.length === 0 ? (
        <p className="rounded-input border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bagianList.map((bagian) => (
            <article
              key={bagian.id}
              className="rounded-card border border-card-border p-4 relative bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-heading-dark line-clamp-1" title={bagian.nama}>{bagian.nama}</h4>
                  {paket.kategori?.toLowerCase().includes("tka") && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${bagian.wajib === false ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{bagian.wajib === false ? "Mapel pilihan" : "Mapel wajib"}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge tone={toneBagianStatus(bagian.status)}>{labelBagianStatus(bagian.status)}</Badge>
                  {!isGuru && (
                    <>
                      <div className="h-4 w-px bg-card-border mx-1" aria-hidden="true" />
                      <button type="button" onClick={() => onEdit(bagian)} className="rounded p-1 text-text-muted transition-colors hover:bg-neutral hover:text-brand-primary" aria-label="Edit Bagian"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteBagian(bagian)} className="rounded p-1 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Hapus Bagian"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {getNama(pelajaranList, bagian.pelajaran_id)}
                {!isGuru && bagian.guru_pengampu && ` · ${bagian.guru_pengampu}`}
              </p>
              <p className="mt-2 text-sm font-medium">
                {bagian.durasi_menit ? `${bagian.durasi_menit} menit` : <span className="text-amber-600">Durasi belum diatur</span>} · {bagian.jumlah_soal} soal
              </p>
              {bagian.status === "revision_required" && (
                <p className="mt-2 rounded-input border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  Perlu revisi: {bagian.review_note || "Tidak ada catatan tambahan."}
                </p>
              )}
              
              <div className="mt-5 flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {!isGuru && <>
                    <button type="button" className="flex items-center justify-center rounded border border-card-border bg-white p-1.5 text-text-muted transition-colors hover:bg-neutral disabled:opacity-30 disabled:hover:bg-white" disabled={bagianList.every((item) => item.id === bagian.id || item.urutan >= bagian.urutan)} onClick={() => void moveBagian(bagian, -1)} aria-label="Naikkan urutan"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" className="flex items-center justify-center rounded border border-card-border bg-white p-1.5 text-text-muted transition-colors hover:bg-neutral disabled:opacity-30 disabled:hover:bg-white" disabled={bagianList.every((item) => item.id === bagian.id || item.urutan <= bagian.urutan)} onClick={() => void moveBagian(bagian, 1)} aria-label="Turunkan urutan"><ArrowDown className="h-4 w-4" /></button>
                  </>}
                  <Button 
                    size="sm" 
                    className="flex-1" 
                    onClick={() => {
                      if (!isGuru && bagian.status === "pending_review") openBagianPicker(bagian);
                      else openIsiSoal(bagian);
                    }}
                  >
                    {!isGuru && bagian.status === "pending_review" ? "Periksa Bagian" : "Isi Soal"}
                  </Button>
                </div>
                
                <div className="relative">
                  <button type="button" onClick={() => setOpenDropdownId(openDropdownId === bagian.id ? null : bagian.id)} className="flex h-[34px] w-[34px] items-center justify-center rounded-btn border border-card-border bg-white text-text-muted transition-colors hover:bg-neutral hover:text-heading-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/30" aria-label="Opsi lainnya" aria-expanded={openDropdownId === bagian.id}>
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {openDropdownId === bagian.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} aria-hidden="true" />
                      <div className="absolute bottom-full right-0 z-50 mb-1 w-44 rounded-modal border border-card-border bg-white p-1 shadow-card animate-in fade-in zoom-in-95 origin-bottom-right">
                        {!isGuru && bagian.status !== "pending_review" && (
                          <button type="button" onClick={() => { setOpenDropdownId(null); openBagianPicker(bagian); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-body-dark transition-colors hover:bg-neutral hover:text-brand-primary">
                            <Eye className="h-4 w-4 text-text-muted" aria-hidden="true" /> Lihat Soal
                          </button>
                        )}
                        {(!isGuru || bagian.status !== "pending_review") && (
                          <button type="button" onClick={() => { setOpenDropdownId(null); updateBagianDuration(bagian); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-body-dark transition-colors hover:bg-neutral hover:text-brand-primary">
                            <Clock className="h-4 w-4 text-text-muted" aria-hidden="true" /> Atur Durasi
                          </button>
                        )}
                        <button type="button" disabled={!bagian.jumlah_soal} onClick={() => { setOpenDropdownId(null); bukaEkspor(bagian); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-body-dark transition-colors hover:bg-neutral hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-body-dark">
                          <FileDown className="h-4 w-4 text-text-muted" aria-hidden="true" /> Unduh Soal
                        </button>
                        {isGuru && (bagian.status === "draft" || bagian.status === "revision_required") && (
                          <button type="button" onClick={() => { setOpenDropdownId(null); submitBagianReview(bagian); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-body-dark transition-colors hover:bg-neutral hover:text-brand-primary">
                            <Send className="h-4 w-4 text-text-muted" aria-hidden="true" /> Ajukan Review
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {bagianPicker && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4">
          <div className="my-6 w-full max-w-2xl rounded-modal bg-card-bg shadow-modal">
            <div className="border-b border-card-border p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">
                  {!isGuru && bagianPicker.status === "pending_review" ? "Periksa Bagian" : "Lihat Soal"} — {bagianPicker.nama}
                </h2>
                <Badge tone={toneBagianStatus(bagianPicker.status)}>{labelBagianStatus(bagianPicker.status)}</Badge>
              </div>
              <p className="text-sm text-text-muted">
                Soal {getNama(pelajaranList, bagianPicker.pelajaran_id)} yang telah ditambahkan ke bagian ini.
                {!isGuru && bagianPicker.guru_pengampu && ` Guru pengampu: ${bagianPicker.guru_pengampu}.`}
              </p>
            </div>
            <div className="p-5">
            <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">
              {bagianQuestions.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  Belum ada soal pada bagian ini.
                </p>
              ) : (
                bagianQuestions.map((soal, index) => (
                  <article
                    key={soal.id}
                    className="rounded-input border border-card-border bg-card-bg p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span className="font-semibold text-heading-dark">
                          Soal {index + 1}
                        </span>
                        <span>#{soal.id}</span>
                        <span>{labelTipeSoal(soal.tipe)}</span>
                        <span>{getNama(topikList, soal.topik_id)}</span>
                        {soal.subbab && <span>{soal.subbab}</span>}
                        {soal.tingkat_kesulitan && (
                          <span>Kesulitan {soal.tingkat_kesulitan}</span>
                        )}
                        {soal.poin != null && <span>{soal.poin} poin</span>}
                      </div>
                      {!isGuru && (
                        <button
                          type="button"
                          onClick={() => flagSoal(soal)}
                          className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700"
                        >
                          Laporkan
                        </button>
                      )}
                    </div>
                    {soal.gambar_url && <img src={soal.gambar_url} alt="" className="mb-2 max-h-48 w-auto max-w-full rounded-input border border-card-border" />}
                    <MathContent
                      className="prose prose-sm max-w-none"
                      html={soal.teks_soal}
                    />
                    <KunciDanPembahasan soal={soal} />
                  </article>
                ))
              )}
            </div>
            </div>
            {!isGuru && bagianPicker.status === "pending_review" ? (
              <div className="space-y-3 border-t border-card-border p-5">
                <Textarea
                  label="Catatan Review"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Wajib diisi bila meminta revisi"
                />
                {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setBagianPicker(null)}>
                    Tutup
                  </Button>
                  <Button
                    variant="danger"
                    disabled={reviewSubmitting}
                    onClick={requestBagianRevision}
                  >
                    Minta Revisi
                  </Button>
                  <Button disabled={reviewSubmitting} onClick={approveBagian}>
                    Setujui Bagian
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-card-border p-5">
                <Button variant="outline" onClick={() => setBagianPicker(null)}>
                  Tutup
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {dialog}
    </>
  );
}

// Preview akhir sebelum dijadwalkan: jawaban (kunci ditandai hijau) + pembahasan, dibuat rapat.
function KunciDanPembahasan({ soal }: { soal: Soal }) {
  const opsi = soal.opsi_jawaban ?? [];
  const pernyataan = soal.pernyataan ?? [];
  const isEsaiAtauIsian = soal.tipe === "isian" || soal.tipe === "esai";
  return (
    <div className="mt-2 space-y-2 text-[13px]">
      {opsi.length > 0 && (
        <ul className="space-y-1">
          {opsi.map((item, index) => (
            <li key={item.id} className={`flex items-start gap-2 rounded-md px-2 py-1 ${item.is_benar ? "bg-green-50 text-green-900 ring-1 ring-green-300" : ""}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${item.is_benar ? "bg-green-600 text-white" : "bg-neutral text-body-dark"}`}>{String.fromCharCode(65 + index)}</span>
              <MathContent className="prose prose-sm min-w-0 flex-1 max-w-none text-[13px] [&_p]:my-0" html={item.teks_opsi} />
              {item.is_benar && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Kunci" />}
            </li>
          ))}
        </ul>
      )}
      {soal.tipe === "benar_salah" && pernyataan.length > 0 && (
        <ol className="space-y-1">
          {pernyataan.map((item, index) => (
            <li key={item.id} className="flex items-start gap-2 px-2 py-1">
              <span className="w-4 shrink-0 text-text-muted">{index + 1}.</span>
              <MathContent className="prose prose-sm min-w-0 flex-1 max-w-none text-[13px] [&_p]:my-0" html={item.teks_pernyataan} />
              <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-300">{item.is_benar ? soal.label_benar || "Benar" : soal.label_salah || "Salah"}</span>
            </li>
          ))}
        </ol>
      )}
      {isEsaiAtauIsian && (
        <div className="flex items-start gap-2 rounded-md bg-green-50 px-2 py-1 ring-1 ring-green-300">
          <span className="shrink-0 font-semibold text-green-700">Kunci:</span>
          {soal.kunci_jawaban ? <MathContent className="prose prose-sm min-w-0 flex-1 max-w-none text-[13px] [&_p]:my-0" html={soal.kunci_jawaban} /> : <span className="text-text-muted">Belum ada kunci jawaban.</span>}
        </div>
      )}
      <div className="rounded-md border-l-2 border-brand-primary/40 bg-neutral/50 px-2 py-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Pembahasan</p>
        {soal.pembahasan ? <MathContent className="prose prose-sm max-w-none text-[13px] [&_p]:my-0.5" html={soal.pembahasan} /> : <p className="text-text-muted">Belum ada pembahasan.</p>}
      </div>
    </div>
  );
}
