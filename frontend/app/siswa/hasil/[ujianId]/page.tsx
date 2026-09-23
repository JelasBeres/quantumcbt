"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, X } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import MathContent from "@/components/MathContent";
import { labelTipeSoal } from "@/lib/tipe-soal";

type HasilMeta = {
  metode_penilaian?: "biasa" | "kohort";
  kohort_n?: number;
  kohort_status?: "sementara" | "final" | "kosong";
  skala?: "utbk" | "tka";
  skor_mentah?: number | null;
  esai_belum_dinilai?: number;
  menunggu_koreksi?: boolean;
};

type Hasil = {
  id: number;
  ujian_siswa_id: number;
  skor?: number | null;
  skor_per_pelajaran_json?: (Record<string, Record<string, unknown>> & { _meta?: HasilMeta }) | null;
  calculated_at?: string | null;
};

type HasilPernyataan = { pernyataan_id: number; teks: string; urutan: number; jawaban_user?: boolean | null; jawaban_benar: boolean; is_correct: boolean };
type HasilOpsi = { id: number; label: string; teks: string; is_benar: boolean };
type HasilSoalDetailItem = {
  nomor: number;
  nomor_bagian?: number | null;
  bagian_nama?: string | null;
  soal_id: number;
  teks_soal: string;
  tipe: string;
  poin?: number;
  opsi: HasilOpsi[];
  label_benar?: string | null;
  label_salah?: string | null;
  pernyataan?: HasilPernyataan[];
  jawaban_user?: number | number[] | string | Array<{ pernyataan_id: number; jawaban: boolean }> | null;
  jawaban_benar?: number | number[] | string | null;
  is_correct?: boolean | null;
  skor_manual?: number | null;
  pembahasan?: string | null;
  is_dijawab?: boolean;
};
type HasilDetail = {
  ujian_siswa_id: number;
  skor?: number | null;
  soal: HasilSoalDetailItem[];
  nama_paket?: string | null;
};

type Status = "benar" | "salah" | "kosong" | "menunggu";

function statusSoal(soal: HasilSoalDetailItem): Status {
  if (!soal.is_dijawab && soal.jawaban_user == null) return "kosong";
  if (soal.tipe === "esai" || soal.tipe === "isian") {
    if (soal.is_correct != null) return soal.is_correct ? "benar" : "salah";
    return "menunggu";
  }
  if (soal.jawaban_user == null || (Array.isArray(soal.jawaban_user) && soal.jawaban_user.length === 0)) return "kosong";
  return soal.is_correct ? "benar" : "salah";
}

function statusLabel(status: Status): string {
  if (status === "benar") return "BENAR";
  if (status === "salah") return "SALAH";
  if (status === "kosong") return "TIDAK DIJAWAB";
  return "MENUNGGU KOREKSI";
}

// Skema warna status (konsisten di halaman ujian & hasil):
// biru = benar, merah = salah, kuning = ragu, abu-abu = kosong/belum dijawab.
function statusCls(status: Status): string {
  if (status === "benar") return "bg-blue-600";
  if (status === "salah") return "bg-red-600";
  if (status === "kosong") return "bg-gray-400";
  return "bg-amber-500";
}

function messageByScore(skor: number | null | undefined): string {
  if (skor == null) return "Nilai belum tersedia.";
  if (skor >= 80) return "Bagus! Pertahankan hasilmu.";
  if (skor >= 60) return "Sudah cukup baik, terus tingkatkan.";
  return "Terus berlatih dan coba lagi.";
}

function teksJawabanUser(soal: HasilSoalDetailItem): string {
  const jawaban = soal.jawaban_user;
  if (jawaban == null) return "(kosong)";
  if (typeof jawaban === "number") {
    const opsi = soal.opsi.find((o) => o.id === jawaban);
    return opsi ? `${opsi.label}. ${opsi.teks.replace(/<[^>]*>/g, "")}` : String(jawaban);
  }
  if (Array.isArray(jawaban)) {
    if (jawaban.some((item) => typeof item === "object")) return jawaban.length ? `${jawaban.length} pernyataan dijawab` : "(kosong)";
    const labels = jawaban
      .map((id) => soal.opsi.find((o) => o.id === id)?.label)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(", ") : "(kosong)";
  }
  return jawaban || "(kosong)";
}

function teksJawabanBenar(soal: HasilSoalDetailItem): string {
  if (soal.tipe === "pilihan_ganda" || soal.tipe === "benar_salah") {
    const benar = soal.opsi.find((o) => o.is_benar);
    return benar ? `${benar.label}. ${benar.teks.replace(/<[^>]*>/g, "")}` : "(tidak tersedia)";
  }
  if (soal.tipe === "pilihan_lebih_dari_satu") {
    const benarList = soal.opsi.filter((o) => o.is_benar);
    return benarList.length > 0 ? benarList.map((o) => `${o.label}. ${o.teks.replace(/<[^>]*>/g, "")}`).join("; ") : "(tidak tersedia)";
  }
  if (soal.jawaban_benar != null) return String(soal.jawaban_benar);
  return "(menunggu koreksi)";
}

function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function HasilDetailPage() {
  const params = useParams<{ ujianId: string }>();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [detail, setDetail] = useState<HasilDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nomor, setNomor] = useState(1);

  const [laporkanSoal, setLaporkanSoal] = useState<HasilSoalDetailItem | null>(null);
  const [alasanLapor, setAlasanLapor] = useState("");
  const [melapor, setMelapor] = useState(false);
  const [pesanLapor, setPesanLapor] = useState("");
  const navStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll navigator mobile agar nomor soal aktif selalu terlihat.
    const container = navStripRef.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-current="true"]');
    if (container && active) {
      container.scrollTo({
        left: active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [nomor]);

  useEffect(() => {
    Promise.all([
      api.get(`/hasil-ujian/ujian/${params.ujianId}`),
      api.get(`/hasil-ujian/ujian/${params.ujianId}/detail`)
    ])
      .then(([hRes, dRes]) => {
        setHasil(hRes.data);
        setDetail(dRes.data);
      })
      .catch((err) => setError(getErrorMessage(err, "Hasil belum tersedia.")))
      .finally(() => setLoading(false));
  }, [params.ujianId]);

  const jumlahBenar = useMemo(() => (detail?.soal ?? []).filter((s) => statusSoal(s) === "benar").length, [detail]);
  const jumlahSalah = useMemo(() => (detail?.soal ?? []).filter((s) => statusSoal(s) === "salah").length, [detail]);
  const jumlahKosong = useMemo(() => (detail?.soal ?? []).filter((s) => statusSoal(s) === "kosong").length, [detail]);
  const totalSoal = detail?.soal.length ?? 0;
  const skor = hasil?.skor ?? detail?.skor ?? null;

  const soalAktif = detail?.soal.find((s) => s.nomor === nomor) ?? null;
  // Nomor ditampilkan per bagian (mulai lagi dari 1), sama seperti saat mengerjakan.
  // `nomor` global tetap dipakai sebagai kunci navigasi.
  const grupBagian = useMemo(() => {
    const groups: { nama: string | null; soal: HasilSoalDetailItem[] }[] = [];
    for (const soal of detail?.soal ?? []) {
      const nama = soal.bagian_nama ?? null;
      const last = groups[groups.length - 1];
      if (last && last.nama === nama) last.soal.push(soal);
      else groups.push({ nama, soal: [soal] });
    }
    return groups;
  }, [detail]);
  const adaBagian = grupBagian.some((g) => g.nama);
  const labelNomor = (soal: HasilSoalDetailItem) => soal.nomor_bagian ?? soal.nomor;
  const judulSoal = (soal: HasilSoalDetailItem) =>
    soal.bagian_nama ? `${soal.bagian_nama} · Soal ${labelNomor(soal)}` : `Soal #${soal.nomor}`;
  const grupAktif = grupBagian.find((g) => g.soal.some((s) => s.nomor === nomor));
  const posisiAktif = adaBagian && soalAktif && grupAktif
    ? { ke: labelNomor(soalAktif), dari: grupAktif.soal.length }
    : { ke: nomor, dari: totalSoal };
  const statusAktif = soalAktif ? statusSoal(soalAktif) : "kosong";

  const kirimLaporan = async (e: FormEvent) => {
    e.preventDefault();
    if (!laporkanSoal) return;
    setMelapor(true);
    setPesanLapor("");
    try {
      await api.post("/laporan-soal/", { soal_id: laporkanSoal.soal_id, alasan: alasanLapor });
      setPesanLapor("Laporan terkirim. Terima kasih!");
      setAlasanLapor("");
    } catch (err: any) {
      setPesanLapor(getErrorMessage(err, "Gagal mengirim laporan."));
    } finally {
      setMelapor(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-text-muted">Memuat hasil...</p>
        </div>
      </main>
    );
  }

  if (error || !hasil) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8">
        <div className="mx-auto max-w-xl rounded-card border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700 shadow-card">{error || "Hasil tidak ditemukan."}</div>
      </main>
    );
  }

  const meta = hasil.skor_per_pelajaran_json?._meta;
  const isCohort = meta?.metode_penilaian === "kohort";
  const skorBulat = skor != null ? Math.round(skor) : 0;
  const skorPembanding = isCohort ? meta?.skor_mentah ?? null : skor;
  const skorPersen = skorPembanding != null ? Math.max(0, Math.min(100, skorPembanding)) : 0;

  return (
    <main className="min-h-screen bg-transparent">
      {/* ===== TOP BAR: back + judul + posisi soal (fixed, semua breakpoint) ===== */}
      <div className="fixed inset-x-0 top-[var(--st-header-h)] z-30 border-b border-card-border bg-card-bg">
        <div className="mx-auto flex h-[3.25rem] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/siswa/riwayat"
            aria-label="Kembali ke riwayat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-body-dark transition hover:bg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </Link>
          <p className="truncate text-sm font-bold text-heading-dark">Pembahasan</p>
          <span className="shrink-0 text-xs font-semibold text-text-muted">
            {posisiAktif.ke} / {posisiAktif.dari}
          </span>
        </div>
      </div>

      {/* ===== NAVIGATOR NOMOR SOAL (mobile/tablet saja) ===== */}
      <div className="fixed inset-x-0 top-[calc(var(--st-header-h)+3.25rem)] z-30 border-b border-card-border bg-card-bg lg:hidden">
        <div className="mx-auto flex h-[3.5rem] w-full max-w-7xl items-center gap-2 px-4 sm:px-6">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-text-muted">Soal</span>
          <div ref={navStripRef} className="flex items-center gap-1.5 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "thin" }}>
            {grupBagian.map((grup, gi) => (
              <Fragment key={`${grup.nama ?? "umum"}-${gi}`}>
                {adaBagian && grup.nama && (
                  <span className={`shrink-0 whitespace-nowrap text-[11px] font-semibold text-text-muted ${gi > 0 ? "ml-2" : ""}`}>{grup.nama}</span>
                )}
                {grup.soal.map((soal) => {
                  const st = statusSoal(soal);
                  const isCurrent = soal.nomor === nomor;
                  return (
                    <button
                      key={soal.soal_id}
                      type="button"
                      onClick={() => setNomor(soal.nomor)}
                      aria-label={judulSoal(soal)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-[13px] font-bold transition-all duration-200 hover:scale-110 ${
                        isCurrent
                          ? "ring-2 ring-brand-primary ring-offset-1 " + statusCls(st)
                          : statusCls(st)
                      } text-white`}
                    >
                      {labelNomor(soal)}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Padding atas mobile mencakup top bar + navigator; desktop hanya top bar */}
      <div className="mx-auto max-w-7xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-[calc(6.75rem+0.75rem)] sm:px-6 lg:pb-28 lg:pt-[calc(3.25rem+1.5rem)]">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_260px] lg:items-start">

          {/* ===== RINGKASAN SKOR (mobile/tablet; di desktop ada di panel kiri) ===== */}
          <div className="flex items-center gap-4 rounded-card border border-card-border bg-card-bg p-4 shadow-card lg:hidden">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 border-brand-primary">
              <span className="text-xl font-extrabold text-heading-dark">{skor != null ? skorBulat : "-"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Nilai</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-800">Benar {jumlahBenar}</span>
                <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">Salah {jumlahSalah}</span>
                <span className="rounded-md bg-neutral px-2 py-1 text-text-muted">Kosong {jumlahKosong}</span>
              </div>
            </div>
          </div>

          {/* ===== KIRI: placeholder lebar grid saja; isi aslinya di panel fixed di bawah ===== */}
          <aside className="hidden lg:order-1 lg:block" aria-hidden="true" />

          {/* ===== TENGAH: REVIEW SOAL ===== */}
          <section className="order-1 min-w-0 lg:order-2">
            {soalAktif ? (
              <div className="rounded-card border border-card-border bg-card-bg shadow-card">
                {/* Bar info soal â€” statis, terpisah dari isi soal */}
                <div className="sticky top-[calc(var(--st-header-h)+6.75rem)] z-20 lg:top-[calc(var(--st-header-h)+3.25rem)] flex flex-wrap items-center justify-between gap-2 rounded-t-card border-b border-card-border bg-card-bg px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-heading-dark">{judulSoal(soalAktif)}</h2>
                    <span className="text-xs text-text-muted">{labelTipeSoal(soalAktif.tipe)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setLaporkanSoal(soalAktif); setPesanLapor(""); setAlasanLapor(""); }}
                      className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-neutral hover:text-heading-dark"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Laporkan soal
                    </button>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${statusCls(statusAktif)}`}>
                      {statusLabel(statusAktif)}
                    </span>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5">
                  <MathContent className="prose prose-sm max-w-none" html={soalAktif.teks_soal} />

                  {soalAktif.tipe === "benar_salah" && soalAktif.pernyataan && soalAktif.pernyataan.length > 0 && (
                    <div className="space-y-2.5">
                      {soalAktif.pernyataan.map((row) => {
                        const label = (value: boolean) => value ? soalAktif.label_benar || "Benar" : soalAktif.label_salah || "Salah";
                        return (
                          <div key={row.pernyataan_id} className={`rounded-input border p-3 ${row.is_correct ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"}`}>
                            <MathContent className="prose prose-sm max-w-none" html={row.teks} />
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              <span className={`font-semibold ${row.is_correct ? "text-blue-700" : "text-red-700"}`}>{row.is_correct ? "Benar" : "Salah"}</span>
                              <span className="text-text-muted">Jawabanmu: <strong className="font-semibold text-body-dark">{row.jawaban_user == null ? "-" : label(row.jawaban_user)}</strong></span>
                              <span className="text-text-muted">Kunci: <strong className="font-semibold text-body-dark">{label(row.jawaban_benar)}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(soalAktif.tipe === "pilihan_ganda" || (soalAktif.tipe === "benar_salah" && !soalAktif.pernyataan?.length) || soalAktif.tipe === "pilihan_lebih_dari_satu") && (
                    <div className="space-y-1.5">
                      {soalAktif.opsi.map((opt) => {
                        const isUser = Array.isArray(soalAktif.jawaban_user)
                          ? (soalAktif.jawaban_user as unknown[]).some((value) => value === opt.id)
                          : opt.id === soalAktif.jawaban_user;
                        const isBenar = opt.is_benar;
                        let style = "border-card-border bg-card-bg";
                        let badge = null;
                        if (isBenar) {
                          style = "border-blue-200 bg-blue-50";
                          badge = <span className="text-xs font-semibold text-blue-800">Kunci jawaban</span>;
                        }
                        if (isUser && !isBenar) {
                          style = "border-red-200 bg-red-50";
                          badge = <span className="text-xs font-semibold text-red-700">Jawabanmu</span>;
                        }
                        return (
                          <div key={opt.id} className={`flex items-start gap-2 rounded-input border p-2.5 ${style}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isUser ? "bg-brand-primary text-white" : "bg-neutral text-body-dark"}`}>{opt.label}</span>
                            <span className="flex-1"><MathContent className="prose prose-sm max-w-none" html={opt.teks} /></span>
                            {badge}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!(soalAktif.tipe === "benar_salah" && soalAktif.pernyataan?.length) && <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">Jawaban Anda</p>
                    {statusAktif === "benar" ? (
                      <div className="rounded-input border border-blue-200 bg-blue-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                          <Check className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading-dark">{teksJawabanUser(soalAktif)}</p>
                      </div>
                    ) : statusAktif === "salah" ? (
                      <div className="rounded-input border border-red-200 bg-red-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                          <X className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading-dark">{teksJawabanUser(soalAktif)}</p>
                      </div>
                    ) : statusAktif === "kosong" ? (
                      <div className="rounded-input border border-card-border bg-neutral p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                          <X className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <p className="mt-1 text-sm italic text-text-muted">Tidak dijawab</p>
                      </div>
                    ) : (
                      <div className="rounded-input border border-amber-200 bg-amber-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Menunggu Koreksi
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading-dark">{teksJawabanUser(soalAktif)}</p>
                        {soalAktif.skor_manual != null && (
                          <p className="mt-1 text-xs text-amber-700">Skor: {soalAktif.skor_manual}</p>
                        )}
                      </div>
                    )}
                  </div>}

                  {!(soalAktif.tipe === "benar_salah" && soalAktif.pernyataan?.length) && (statusAktif === "salah" || statusAktif === "kosong") && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">Jawaban Benar</p>
                      <div className="rounded-input border border-blue-200 bg-blue-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                          <Check className="h-3.5 w-3.5" /> Jawaban Benar
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading-dark">{teksJawabanBenar(soalAktif)}</p>
                      </div>
                    </div>
                  )}

                  {/* Pembahasan */}
                  {soalAktif.pembahasan && soalAktif.pembahasan.trim() && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">Pembahasan</p>
                      <div className="rounded-input border border-card-border bg-neutral p-3.5">
                        <MathContent className="prose prose-sm max-w-none" html={soalAktif.pembahasan} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-card border border-card-border bg-card-bg p-10 text-center shadow-card">
                <p className="text-sm text-text-muted">Belum ada rincian soal.</p>
              </div>
            )}
          </section>

          {/* ===== KANAN: placeholder lebar grid saja; isi aslinya di panel fixed di bawah ===== */}
          <aside className="hidden lg:order-3 lg:block" aria-hidden="true" />
        </div>
      </div>

      {/* ===== PANEL KIRI & KANAN (fixed, tidak ikut scroll konten soal; masing-masing scroll internal) ===== */}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--st-header-h)+3.25rem+1rem)] bottom-20 z-20 hidden lg:block">
        <div className="mx-auto grid h-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
          {/* KIRI: SKOR & RINGKASAN â€” scrollbar disembunyikan */}
          <div className="pointer-events-auto h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-card border border-card-border bg-card-bg p-5 shadow-card">
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={skorPembanding != null && skorPembanding >= 80 ? "#1E7A4D" : skorPembanding != null && skorPembanding >= 60 ? "#D97706" : "#C0392B"}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(skorPersen / 100) * 326.7} 326.7`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-heading-dark">{skor != null ? skorBulat : "-"}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{isCohort ? `Benchmark IRT · ${(meta?.skala ?? "utbk").toUpperCase()}` : "Nilai Biasa"}</p>
                {isCohort && <p className="mt-1 text-xs text-text-muted">Skor mentah {meta?.skor_mentah ?? "-"} · {meta?.kohort_status === "final" ? "Final" : meta?.kohort_status === "kosong" ? "Belum tersedia" : "Sementara"}</p>}
                <p className="mt-2 text-sm font-medium text-body-dark">{messageByScore(skorPembanding)}</p>
              </div>

              <div className="my-4 border-t border-card-border" />

              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Ringkasan</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between rounded-input bg-blue-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-blue-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="h-3 w-3" /></span>
                    Benar
                  </span>
                  <span className="text-sm font-bold text-blue-800">{jumlahBenar}</span>
                </div>
                <div className="flex items-center justify-between rounded-input bg-red-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-red-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"><X className="h-3 w-3" /></span>
                    Salah
                  </span>
                  <span className="text-sm font-bold text-red-700">{jumlahSalah}</span>
                </div>
                <div className="flex items-center justify-between rounded-input bg-neutral px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white"><X className="h-3 w-3" /></span>
                    Kosong
                  </span>
                  <span className="text-sm font-bold text-text-muted">{jumlahKosong}</span>
                </div>
              </div>

              <div className="my-4 border-t border-card-border" />

              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Detail</p>
              <div className="mt-2 space-y-1.5 text-xs text-body-dark">
                <p className="flex justify-between"><span>Total soal</span><span className="font-semibold text-heading-dark">{totalSoal}</span></p>
                <p className="flex justify-between"><span>Selesai</span><span className="font-semibold text-heading-dark">{formatTanggal(detail?.soal.length ? hasil.calculated_at : null)}</span></p>
              </div>

              {meta?.kohort_status === "sementara" && (
                <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Benchmark IRT masih sementara karena peserta kurang dari 5 atau koreksi esai belum selesai.
                </p>
              )}
              {hasil.skor_per_pelajaran_json?._meta?.menunggu_koreksi && (
                <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Nilai sementara. Ada jawaban yang masih menunggu koreksi guru.
                </p>
              )}
            </div>

            <div className="mt-4 rounded-card border border-card-border bg-card-bg p-4 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Rincian per Pelajaran</p>
              {hasil.skor_per_pelajaran_json && Object.keys(hasil.skor_per_pelajaran_json).filter((k) => k !== "_meta").length > 0 ? (
                <div className="mt-2 space-y-2">
                  {Object.entries(hasil.skor_per_pelajaran_json).filter(([key]) => key !== "_meta").map(([pelajaran, item]) => {
                    const d = item as Record<string, unknown>;
                    return (
                      <div key={pelajaran} className="rounded-input bg-neutral p-2.5">
                        <p className="text-xs font-semibold text-heading-dark">{String(d.nama ?? pelajaran)}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {String(d.jumlah_benar ?? 0)} benar · {String(d.jumlah_soal ?? 0)} soal
                          <span className="ml-1 font-semibold text-heading-dark">{String(d.skor ?? 0)}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-muted">Tidak tersedia.</p>
              )}
            </div>
          </div>

          {/* spacer kolom tengah: konten soal sudah ada di grid yang scroll normal di atas */}
          <div />

          {/* KANAN: GRID NAVIGASI SOAL */}
          <div className="pointer-events-auto h-full overflow-y-auto">
            <div className="rounded-card border border-card-border bg-card-bg p-4 shadow-card">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Navigasi Soal</p>
              <div className="space-y-3">
                {grupBagian.map((grup, gi) => (
                  <div key={`${grup.nama ?? "umum"}-${gi}`}>
                    {adaBagian && grup.nama && (
                      <p className="mb-1.5 text-xs font-semibold text-heading-dark">{grup.nama}</p>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      {grup.soal.map((soal) => {
                        const st = statusSoal(soal);
                        const isCurrent = soal.nomor === nomor;
                        return (
                          <button
                            key={soal.soal_id}
                            type="button"
                            onClick={() => setNomor(soal.nomor)}
                            aria-label={judulSoal(soal)}
                            aria-current={isCurrent ? "true" : undefined}
                            className={`aspect-square w-full transform rounded-lg border border-transparent font-bold transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                              isCurrent
                                ? "ring-2 ring-brand-primary ring-offset-1 " + statusCls(st)
                                : statusCls(st)
                            } text-white`}
                          >
                            {labelNomor(soal)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-card-border pt-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Benar</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Salah</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Kosong</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Menunggu koreksi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FOOTER FIXED: Sebelumnya / Soal X dari Y / Berikutnya ===== */}
      {/* Dinaikkan di atas bottom nav aplikasi pada mobile agar tidak tertutup. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card-bg pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" size="sm" disabled={nomor <= 1} onClick={() => setNomor((n) => Math.max(1, n - 1))}>
            Sebelumnya
          </Button>
          <span className="text-xs font-semibold text-text-muted">
            {adaBagian && grupAktif?.nama ? `${grupAktif.nama} · ` : ""}Soal {posisiAktif.ke} dari {posisiAktif.dari}
          </span>
          <Button variant="outline" size="sm" disabled={nomor >= totalSoal} onClick={() => setNomor((n) => Math.min(totalSoal, n + 1))}>
            Berikutnya
          </Button>
        </div>
      </div>

      {/* ===== MODAL LAPORKAN SOAL ===== */}
      {laporkanSoal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="laporkan-title">
          <div className="my-8 w-full max-w-md rounded-modal border border-card-border bg-card-bg shadow-modal">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <h3 id="laporkan-title" className="text-base font-bold text-heading-dark">Laporkan {judulSoal(laporkanSoal)}</h3>
              <button type="button" onClick={() => setLaporkanSoal(null)} className="rounded-btn px-2 py-1 text-xl text-text-muted transition hover:bg-neutral hover:text-heading-dark" aria-label="Tutup">×</button>
            </div>
            <form onSubmit={kirimLaporan} className="space-y-4 p-5">
              <div>
                <label htmlFor="alasan-lapor" className="mb-1.5 block text-sm font-semibold text-body-dark">Alasan pelaporan</label>
                <textarea
                  id="alasan-lapor"
                  value={alasanLapor}
                  onChange={(e) => setAlasanLapor(e.target.value)}
                  rows={4}
                  required
                  placeholder="Jelaskan masalah pada soal ini..."
                  className="w-full rounded-input border border-card-border bg-card-bg p-3 text-sm text-body-dark placeholder:text-text-muted outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              {pesanLapor && <p className="text-sm text-green-700">{pesanLapor}</p>}
              <div className="flex justify-end gap-2">
                 <Button type="button" variant="outline" size="sm" onClick={() => setLaporkanSoal(null)}>{pesanLapor ? "Tutup" : "Batal"}</Button>
                 {!pesanLapor && (
                   <Button type="submit" size="sm" disabled={melapor || !alasanLapor.trim()}>
                     {melapor ? "Mengirim..." : "Kirim Laporan"}
                   </Button>
                 )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
