"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Flag, X } from "lucide-react";
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

// Kunci (is_benar/jawaban_benar/is_correct) bernilai null selama kunci ditahan.
type HasilPernyataan = { pernyataan_id: number; teks: string; urutan: number; jawaban_user?: boolean | null; jawaban_benar?: boolean | null; is_correct?: boolean | null };
type HasilOpsi = { id: number; label: string; teks: string; is_benar?: boolean | null };
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
  bagian_id?: number | null;
  is_ragu?: boolean;
};

// Penanda ragu-ragu di pojok nomor soal; warna nomor tetap benar/salah/kosong.
function TandaRagu() {
  return (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-yellow-950 ring-2 ring-card-bg" aria-hidden="true">
      <Flag className="h-2.5 w-2.5" />
    </span>
  );
}
type HasilDetail = {
  ujian_siswa_id: number;
  skor?: number | null;
  soal: HasilSoalDetailItem[];
  nama_paket?: string | null;
  kunci_disembunyikan?: boolean;
  kunci_tersedia_at?: string | null;
};

type Status = "benar" | "salah" | "kosong" | "menunggu" | "terjawab";

function statusSoal(soal: HasilSoalDetailItem, kunciDitahan = false): Status {
  if (!soal.is_dijawab && soal.jawaban_user == null) return "kosong";
  if (kunciDitahan) {
    // Benar/salah belum boleh diketahui selama jadwal tryout masih berjalan.
    const jawaban = soal.jawaban_user;
    const kosong = jawaban == null || jawaban === "" || (Array.isArray(jawaban) && jawaban.length === 0);
    return kosong ? "kosong" : "terjawab";
  }
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
  if (status === "terjawab") return "TERJAWAB";
  return "MENUNGGU KOREKSI";
}

// Skema warna status (konsisten di halaman ujian & hasil):
// hijau = benar, merah = salah, kuning = menunggu koreksi, abu-abu = kosong/belum dijawab.
function statusCls(status: Status): string {
  if (status === "benar") return "bg-green-600";
  if (status === "salah") return "bg-red-600";
  if (status === "kosong") return "bg-gray-400";
  if (status === "terjawab") return "bg-slate-500";
  return "bg-amber-500";
}

function messageByScore(skor: number | null | undefined): string {
  if (skor == null) return "Nilai belum tersedia.";
  if (skor >= 80) return "Bagus! Pertahankan hasilmu.";
  if (skor >= 60) return "Sudah cukup baik, terus tingkatkan.";
  return "Terus berlatih dan coba lagi.";
}

// Jawaban ditampilkan sebagai HTML (dirender MathContent) agar rumus, pangkat, tebal,
// dll. di opsi tetap tampil; teks ketikan siswa di-escape dulu.
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const teksKeHtml = (text: string) => (/<[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text));

function htmlOpsi(label: string, teks: string): string {
  const huruf = `<strong>${escapeHtml(label)}.</strong> `;
  return teks.startsWith("<p>") ? `<p>${huruf}${teks.slice(3)}` : `${huruf}${teks}`;
}

function htmlJawabanUser(soal: HasilSoalDetailItem): string {
  const jawaban = soal.jawaban_user;
  if (jawaban == null) return "(kosong)";
  if (typeof jawaban === "number") {
    const opsi = soal.opsi.find((o) => o.id === jawaban);
    return opsi ? htmlOpsi(opsi.label, opsi.teks) : String(jawaban);
  }
  if (Array.isArray(jawaban)) {
    if (jawaban.some((item) => typeof item === "object")) return jawaban.length ? `${jawaban.length} pernyataan dijawab` : "(kosong)";
    const dipilih = jawaban
      .map((id) => soal.opsi.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    return dipilih.length > 0 ? dipilih.map((o) => htmlOpsi(o.label, o.teks)).join("") : "(kosong)";
  }
  return jawaban ? escapeHtml(String(jawaban)) : "(kosong)";
}

function htmlJawabanBenar(soal: HasilSoalDetailItem): string {
  if (soal.tipe === "pilihan_ganda" || soal.tipe === "benar_salah") {
    const benar = soal.opsi.find((o) => o.is_benar);
    return benar ? htmlOpsi(benar.label, benar.teks) : "(tidak tersedia)";
  }
  if (soal.tipe === "pilihan_lebih_dari_satu") {
    const benarList = soal.opsi.filter((o) => o.is_benar);
    return benarList.length > 0 ? benarList.map((o) => htmlOpsi(o.label, o.teks)).join("") : "(tidak tersedia)";
  }
  if (soal.jawaban_benar != null) return teksKeHtml(String(soal.jawaban_benar));
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
  // Dari Riwayat per mapel: ?bagian=<id> (atau "none" untuk soal di luar bagian)
  // hanya menampilkan soal mapel itu; ?kategori= untuk tombol kembali.
  const searchParams = useSearchParams();
  const bagianParam = searchParams.get("bagian");
  const kategoriParam = searchParams.get("kategori");
  // Kembali ke grup riwayat asalnya: latihan -> daftar set soal mapel itu (?mapel=)
  // atau daftar mapel kategori itu, tryout -> halaman mapel tryout tersebut.
  const mapelParam = searchParams.get("mapel");
  const hrefKembali = !kategoriParam
    ? "/siswa/riwayat"
    : searchParams.get("jenis") === "latihan"
      ? `/siswa/riwayat/latihan/${encodeURIComponent(kategoriParam)}${mapelParam ? `/${encodeURIComponent(mapelParam)}` : ""}`
      : `/siswa/riwayat/tryout/${encodeURIComponent(kategoriParam)}/${params.ujianId}`;

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

  const kunciDitahan = !!detail?.kunci_disembunyikan;
  const soalList = useMemo(() => {
    const semua = detail?.soal ?? [];
    if (!bagianParam) return semua;
    return semua.filter((s) => (bagianParam === "none" ? s.bagian_id == null : String(s.bagian_id) === bagianParam));
  }, [detail, bagianParam]);
  const namaBagianFilter = bagianParam ? soalList[0]?.bagian_nama ?? null : null;
  useEffect(() => {
    // Mulai dari soal pertama mapel yang dipilih.
    if (soalList.length > 0 && !soalList.some((s) => s.nomor === nomor)) setNomor(soalList[0].nomor);
  }, [soalList, nomor]);
  const jumlahBenar = useMemo(() => soalList.filter((s) => statusSoal(s, kunciDitahan) === "benar").length, [soalList, kunciDitahan]);
  const jumlahSalah = useMemo(() => soalList.filter((s) => statusSoal(s, kunciDitahan) === "salah").length, [soalList, kunciDitahan]);
  const jumlahKosong = useMemo(() => soalList.filter((s) => statusSoal(s, kunciDitahan) === "kosong").length, [soalList, kunciDitahan]);
  const jumlahTerjawab = useMemo(() => soalList.filter((s) => statusSoal(s, kunciDitahan) === "terjawab").length, [soalList, kunciDitahan]);
  const jumlahRagu = useMemo(() => soalList.filter((s) => s.is_ragu).length, [soalList]);
  const totalSoal = soalList.length;
  const skor = hasil?.skor ?? detail?.skor ?? null;

  const indeksAktif = soalList.findIndex((s) => s.nomor === nomor);
  const soalAktif = indeksAktif >= 0 ? soalList[indeksAktif] : null;
  // Nomor ditampilkan per bagian (mulai lagi dari 1), sama seperti saat mengerjakan.
  // `nomor` global tetap dipakai sebagai kunci navigasi.
  const grupBagian = useMemo(() => {
    const groups: { nama: string | null; soal: HasilSoalDetailItem[] }[] = [];
    for (const soal of soalList) {
      const nama = soal.bagian_nama ?? null;
      const last = groups[groups.length - 1];
      if (last && last.nama === nama) last.soal.push(soal);
      else groups.push({ nama, soal: [soal] });
    }
    return groups;
  }, [soalList]);
  const adaBagian = grupBagian.some((g) => g.nama);
  const labelNomor = (soal: HasilSoalDetailItem) => soal.nomor_bagian ?? soal.nomor;
  const judulSoal = (soal: HasilSoalDetailItem) =>
    soal.bagian_nama ? `${soal.bagian_nama} · Soal ${labelNomor(soal)}` : `Soal #${soal.nomor}`;
  const grupAktif = grupBagian.find((g) => g.soal.some((s) => s.nomor === nomor));
  const posisiAktif = adaBagian && soalAktif && grupAktif
    ? { ke: labelNomor(soalAktif), dari: grupAktif.soal.length }
    : { ke: nomor, dari: totalSoal };
  const statusAktif = soalAktif ? statusSoal(soalAktif, kunciDitahan) : "kosong";

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
            href={hrefKembali}
            aria-label="Kembali ke riwayat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-body-dark transition hover:bg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </Link>
          <p className="truncate text-sm font-bold text-heading-dark">Pembahasan{namaBagianFilter ? ` · ${namaBagianFilter}` : ""}</p>
          <span className="shrink-0 text-xs font-semibold text-text-muted">
            {posisiAktif.ke} / {posisiAktif.dari}
          </span>
        </div>
      </div>

      {/* ===== NAVIGATOR NOMOR SOAL (mobile/tablet saja) ===== */}
      <div className="fixed inset-x-0 top-[calc(var(--st-header-h)+3.25rem)] z-30 border-b border-card-border bg-card-bg lg:hidden">
        <div className="mx-auto flex h-[3.5rem] w-full max-w-7xl items-center gap-2 px-4 sm:px-6">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-text-muted">Soal</span>
          <div ref={navStripRef} className="flex items-center gap-1.5 overflow-x-auto px-1.5 py-1.5" style={{ scrollbarWidth: "thin" }}>
            {grupBagian.map((grup, gi) => (
              <Fragment key={`${grup.nama ?? "umum"}-${gi}`}>
                {adaBagian && grup.nama && (
                  <span className={`shrink-0 whitespace-nowrap text-[11px] font-semibold text-text-muted ${gi > 0 ? "ml-2" : ""}`}>{grup.nama}</span>
                )}
                {grup.soal.map((soal) => {
                  const st = statusSoal(soal, kunciDitahan);
                  const isCurrent = soal.nomor === nomor;
                  return (
                    <button
                      key={soal.soal_id}
                      type="button"
                      onClick={() => setNomor(soal.nomor)}
                      aria-label={`${judulSoal(soal)}${soal.is_ragu ? " (ragu-ragu)" : ""}`}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-[13px] font-bold transition-all duration-200 hover:scale-110 ${
                        isCurrent
                          ? "ring-2 ring-brand-primary ring-offset-1 " + statusCls(st)
                          : statusCls(st)
                      } text-white`}
                    >
                      {labelNomor(soal)}
                      {soal.is_ragu && <TandaRagu />}
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
                {kunciDitahan ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">Terjawab {jumlahTerjawab}</span>
                ) : (
                  <>
                    <span className="rounded-md bg-green-50 px-2 py-1 text-green-800">Benar {jumlahBenar}</span>
                    <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">Salah {jumlahSalah}</span>
                  </>
                )}
                <span className="rounded-md bg-neutral px-2 py-1 text-text-muted">Kosong {jumlahKosong}</span>
                {jumlahRagu > 0 && <span className="rounded-md bg-yellow-100 px-2 py-1 text-yellow-800">Ragu-ragu {jumlahRagu}</span>}
              </div>
            </div>
          </div>

          {/* ===== KIRI: placeholder lebar grid saja; isi aslinya di panel fixed di bawah ===== */}
          <aside className="hidden lg:order-1 lg:block" aria-hidden="true" />

          {/* ===== TENGAH: REVIEW SOAL ===== */}
          <section className="order-1 min-w-0 lg:order-2">
            {kunciDitahan && (
              <div className="mb-4 flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Kunci jawaban dan pembahasan akan tersedia setelah jadwal try out ini berakhir
                  {detail?.kunci_tersedia_at ? ` (${formatTanggal(detail.kunci_tersedia_at)})` : ""}.
                </p>
              </div>
            )}
            {soalAktif ? (
              <div className="rounded-card border border-card-border bg-card-bg shadow-card">
                {/* Bar info soal â€” statis, terpisah dari isi soal */}
                <div className="sticky top-[calc(var(--st-header-h)+6.75rem)] z-20 lg:top-[calc(var(--st-header-h)+3.25rem)] flex flex-wrap items-center justify-between gap-2 rounded-t-card border-b border-card-border bg-card-bg px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-heading-dark">{judulSoal(soalAktif)}</h2>
                    <span className="text-xs text-text-muted">{labelTipeSoal(soalAktif.tipe)}</span>
                    {soalAktif.is_ragu && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                        <Flag className="h-3 w-3" aria-hidden="true" /> Ragu-ragu
                      </span>
                    )}
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
                    <div className="overflow-x-auto rounded-input border border-card-border">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <thead>
                          <tr className="bg-neutral text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-xs">
                            <th scope="col" className="w-9 px-1 py-2.5 text-center sm:w-10 sm:px-3">No</th>
                            <th scope="col" className="px-2 py-2.5 sm:px-3">Pernyataan</th>
                            <th scope="col" className="w-[4.75rem] break-words px-1 py-2.5 text-center sm:w-24 sm:px-2">Jawabanmu</th>
                            <th scope="col" className="w-16 break-words px-1 py-2.5 text-center sm:w-20 sm:px-2">Kunci</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soalAktif.pernyataan.map((row, index) => {
                            const label = (value: boolean) => value ? soalAktif.label_benar || "Benar" : soalAktif.label_salah || "Salah";
                            return (
                              <tr key={row.pernyataan_id} className={`border-t border-card-border align-middle ${row.is_correct === false ? "bg-red-50" : ""}`}>
                                <td className="px-1 py-3 text-center font-semibold text-text-muted sm:px-3">{index + 1}</td>
                                <td className="px-2 py-3 sm:px-3"><MathContent className="prose prose-sm max-w-none prose-p:my-0" html={row.teks} /></td>
                                <td className="break-words px-1 py-3 text-center sm:px-2">
                                  {row.is_correct == null ? (
                                    <span className="font-semibold text-body-dark">{row.jawaban_user == null ? "-" : label(row.jawaban_user)}</span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1 font-semibold ${row.is_correct ? "text-green-700" : "text-red-700"}`}>
                                      {row.is_correct ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                                      {row.jawaban_user == null ? "-" : label(row.jawaban_user)}
                                      <span className="sr-only">{row.is_correct ? "(benar)" : "(salah)"}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="break-words px-1 py-3 text-center font-semibold text-body-dark sm:px-2">{row.jawaban_benar == null ? "-" : label(row.jawaban_benar)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
                          style = "border-green-200 bg-green-50";
                          badge = <span className="text-xs font-semibold text-green-800">Kunci jawaban</span>;
                        }
                        if (isUser && kunciDitahan) {
                          style = "border-brand-primary/40 bg-brand-primary/5";
                          badge = <span className="text-xs font-semibold text-brand-primary">Jawabanmu</span>;
                        } else if (isUser && !isBenar) {
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
                      <div className="rounded-input border border-green-200 bg-green-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-green-800">
                          <Check className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <MathContent className="mt-1 break-words text-sm font-medium text-heading-dark" html={htmlJawabanUser(soalAktif)} />
                      </div>
                    ) : statusAktif === "salah" ? (
                      <div className="rounded-input border border-red-200 bg-red-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                          <X className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <MathContent className="mt-1 break-words text-sm font-medium text-heading-dark" html={htmlJawabanUser(soalAktif)} />
                      </div>
                    ) : statusAktif === "kosong" ? (
                      <div className="rounded-input border border-card-border bg-neutral p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                          <X className="h-3.5 w-3.5" /> Jawaban Anda
                        </p>
                        <p className="mt-1 text-sm italic text-text-muted">Tidak dijawab</p>
                      </div>
                    ) : statusAktif === "terjawab" ? (
                      <div className="rounded-input border border-card-border bg-neutral p-3.5">
                        <p className="text-xs font-bold text-body-dark">Jawaban Anda</p>
                        <MathContent className="mt-1 break-words text-sm font-medium text-heading-dark" html={htmlJawabanUser(soalAktif)} />
                      </div>
                    ) : (
                      <div className="rounded-input border border-amber-200 bg-amber-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Menunggu Koreksi
                        </p>
                        <MathContent className="mt-1 break-words text-sm font-medium text-heading-dark" html={htmlJawabanUser(soalAktif)} />
                        {soalAktif.skor_manual != null && (
                          <p className="mt-1 text-xs text-amber-700">Skor: {soalAktif.skor_manual}</p>
                        )}
                      </div>
                    )}
                  </div>}

                  {!kunciDitahan && !(soalAktif.tipe === "benar_salah" && soalAktif.pernyataan?.length) && (statusAktif === "salah" || statusAktif === "kosong") && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">Jawaban Benar</p>
                      <div className="rounded-input border border-green-200 bg-green-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-green-800">
                          <Check className="h-3.5 w-3.5" /> Jawaban Benar
                        </p>
                        <MathContent className="mt-1 break-words text-sm font-medium text-heading-dark" html={htmlJawabanBenar(soalAktif)} />
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
                {kunciDitahan ? (
                <div className="flex items-center justify-between rounded-input bg-slate-100 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-white"><Check className="h-3 w-3" /></span>
                    Terjawab
                  </span>
                  <span className="text-sm font-bold text-slate-700">{jumlahTerjawab}</span>
                </div>
                ) : (<>
                <div className="flex items-center justify-between rounded-input bg-green-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-green-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-3 w-3" /></span>
                    Benar
                  </span>
                  <span className="text-sm font-bold text-green-800">{jumlahBenar}</span>
                </div>
                <div className="flex items-center justify-between rounded-input bg-red-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-red-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"><X className="h-3 w-3" /></span>
                    Salah
                  </span>
                  <span className="text-sm font-bold text-red-700">{jumlahSalah}</span>
                </div>
                </>)}
                <div className="flex items-center justify-between rounded-input bg-neutral px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white"><X className="h-3 w-3" /></span>
                    Kosong
                  </span>
                  <span className="text-sm font-bold text-text-muted">{jumlahKosong}</span>
                </div>
                <div className="flex items-center justify-between rounded-input bg-yellow-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-yellow-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-950"><Flag className="h-3 w-3" /></span>
                    Ragu-ragu
                  </span>
                  <span className="text-sm font-bold text-yellow-800">{jumlahRagu}</span>
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
                  Nilai sementara. Esai yang belum dikoreksi guru dihitung 0 dulu; nilai diperbarui otomatis setelah dikoreksi.
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
                        const st = statusSoal(soal, kunciDitahan);
                        const isCurrent = soal.nomor === nomor;
                        return (
                          <button
                            key={soal.soal_id}
                            type="button"
                            onClick={() => setNomor(soal.nomor)}
                            aria-label={`${judulSoal(soal)}${soal.is_ragu ? " (ragu-ragu)" : ""}`}
                            aria-current={isCurrent ? "true" : undefined}
                            className={`relative aspect-square w-full transform rounded-lg border border-transparent font-bold transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                              isCurrent
                                ? "ring-2 ring-brand-primary ring-offset-1 " + statusCls(st)
                                : statusCls(st)
                            } text-white`}
                          >
                            {labelNomor(soal)}
                            {soal.is_ragu && <TandaRagu />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-card-border pt-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Benar</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Salah</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Kosong</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Menunggu koreksi</span>
                <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-yellow-950"><Flag className="h-2 w-2" /></span> Ditandai ragu-ragu</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FOOTER FIXED: Sebelumnya / Soal X dari Y / Berikutnya ===== */}
      {/* Dinaikkan di atas bottom nav aplikasi pada mobile agar tidak tertutup. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card-bg pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" size="sm" disabled={indeksAktif <= 0} onClick={() => indeksAktif > 0 && setNomor(soalList[indeksAktif - 1].nomor)}>
            Sebelumnya
          </Button>
          <span className="text-xs font-semibold text-text-muted">
            {adaBagian && grupAktif?.nama ? `${grupAktif.nama} · ` : ""}Soal {posisiAktif.ke} dari {posisiAktif.dari}
          </span>
          <Button variant="outline" size="sm" disabled={indeksAktif < 0 || indeksAktif >= soalList.length - 1} onClick={() => indeksAktif >= 0 && indeksAktif < soalList.length - 1 && setNomor(soalList[indeksAktif + 1].nomor)}>
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
