"use client";
import LatihanList from "@/components/LatihanList";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  Clock3,
  FileText,
  Search,
  AlertCircle,
  Zap,
  PlayCircle,
  Users,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import Card from "@/components/Card";

type BagianTersedia = {
  bagian_id: number;
  nama: string;
  urutan: number;
  jumlah_soal: number;
};

type Jadwal = {
  jadwal_ujian_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  mulai: string;
  selesai: string;
  status: "mendatang" | "berlangsung" | "berakhir";
  grup_tryout_id?: number | null;
  nama_grup_tryout?: string | null;
  durasi_menit?: number;
  jumlah_soal?: number;
  pelajaran?: string | null;
  tipe?: "ujian" | "latihan" | string;
  kategori?: string | null;
  kategori_nama?: string | null;
  bagian?: BagianTersedia[];
};

function formatDurasi(menit: number) {
  if (menit < 60) return `${menit} Menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa > 0 ? `${jam} Jam ${sisa} Menit` : `${jam} Jam`;
}

function formatTanggalRingkas(mulai: string, selesai: string) {
  const d1 = new Date(mulai);
  const d2 = new Date(selesai);
  const sameDay = d1.toDateString() === d2.toDateString();
  const tgl = d1.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const jam1 = d1.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const jam2 = d2.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `${tgl}, ${jam1}–${jam2}`;
  const tgl2 = d2.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return `${tgl} ${jam1} – ${tgl2} ${jam2}`;
}

// Ikon per tipe — dipakai di grid kategori gaya "bisadanedu" (ikon besar + label,
// bukan tab kecil). Fallback ke LayoutGrid kalau tipe tidak dikenali.
function tipeIcon(tipe: string) {
  if (tipe === "latihan") return BookOpen;
  if (tipe === "ujian") return FileText;
  return LayoutGrid;
}

function tipeLabel(tipe: string) {
  if (tipe === "semua") return "Semua";
  if (tipe === "latihan") return "Latihan";
  return "Ujian";
}

function ctaConfig(status: Jadwal["status"], sudahSelesai: boolean) {
  if (sudahSelesai) {
    return {
      label: "Lihat Hasil",
      icon: FileText,
      cls: "border border-card-border bg-white text-body-dark shadow-none hover:bg-neutral"
    };
  }
  if (status === "berlangsung") {
    return {
      label: "Kerjakan Sekarang",
      icon: PlayCircle,
      cls: "bg-cta text-white shadow-lg shadow-cta/20 hover:bg-cta-alt"
    };
  }
  if (status === "mendatang") {
    return {
      label: "Lihat Detail",
      icon: ChevronRight,
      cls: "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary-light"
    };
  }
  return {
    label: "Lihat Hasil",
    icon: FileText,
    cls: "border border-card-border bg-white text-body-dark shadow-none hover:bg-neutral"
  };
}

function StatusBadge({ status, sudahSelesai, onClick }: { status: Jadwal["status"]; sudahSelesai: boolean; onClick?: () => void }) {
  if (sudahSelesai) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-white px-2.5 py-1 text-[11px] font-semibold text-body-dark">
        Lihat Hasil
      </span>
    );
  }
  const style =
    status === "berlangsung"
      ? "border border-green-200 bg-green-50 text-green-700"
      : status === "mendatang"
        ? "border border-amber-200 bg-amber-50 text-amber-700"
        : "border border-neutral bg-neutral text-body-dark";
  const label = status === "berlangsung" ? "Berlangsung" : status === "mendatang" ? "Akan Datang" : "Selesai";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      {status === "berlangsung" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
      {label}
    </span>
  );
}

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-card border border-card-border bg-card-bg p-4">
          <div className="h-11 w-11 animate-pulse rounded-full bg-neutral" />
          <div className="h-3 w-14 animate-pulse rounded bg-neutral" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-card border border-card-border bg-card-bg p-5">
      <div className="h-4 w-24 rounded-full bg-neutral" />
      <div className="mt-3 h-5 w-3/4 rounded bg-neutral" />
      <div className="mt-3 h-3 w-40 rounded bg-neutral" />
      <div className="mt-5 h-11 w-full rounded-btn bg-neutral" />
    </div>
  );
}

export default function JadwalSiswaPage() {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [jadwalSelesaiSet, setJadwalSelesaiSet] = useState<Set<number>>(new Set());
  const [hasilByJadwal, setHasilByJadwal] = useState<Map<number, number>>(new Map());
  const [tipeAktif, setTipeAktif] = useState("semua");
  const [mapelAktif, setMapelAktif] = useState("semua");
  const [cari, setCari] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/siswa/jadwal-tersedia"),
      api.get("/siswa/riwayat-ujian")
    ])
      .then(([jadwalRes, riwayatRes]) => {
        setJadwal(jadwalRes.data ?? []);
        const riwayat: { ujian_siswa_id: number; jadwal_ujian_id?: number | null; is_submitted: boolean }[] = riwayatRes.data ?? [];
        const selesai = riwayat
          .filter((r) => r.is_submitted && r.jadwal_ujian_id != null)
          .map((r) => r.jadwal_ujian_id as number);
        setJadwalSelesaiSet(new Set(selesai));
        setHasilByJadwal(new Map(riwayat.filter((r) => r.is_submitted && r.jadwal_ujian_id != null).map((r) => [r.jadwal_ujian_id as number, r.ujian_siswa_id])));
      })
      .catch(() => setError("Jadwal belum bisa dimuat. Coba muat ulang halaman ini."))
      .finally(() => setLoading(false));
  }, []);

  const sedangBerlangsung = useMemo(
    () => jadwal.filter((item) => item.status === "berlangsung"),
    [jadwal]
  );

  // Kategori tipe ditampilkan sebagai grid ikon, meniru pola "Pilih Kategori Latihan"
  // di bisadanedu.com — nilai & filter logic tetap sama seperti sebelumnya.
  const tipeList = useMemo(() => {
    const semuaTipe = ["semua", "ujian", "latihan"];
    return semuaTipe
      .map((value) => ({
        value,
        label: tipeLabel(value),
        jumlah: value === "semua" ? jadwal.length : jadwal.filter((j) => (j.tipe ?? "ujian") === value).length,
      }))
      .filter((t) => t.value === "semua" || t.jumlah > 0);
  }, [jadwal]);

  const mapelList = useMemo(() => {
    const set = new Set<string>();
    jadwal.forEach((item) => set.add(item.pelajaran?.trim() || "Umum"));
    return Array.from(set).sort();
  }, [jadwal]);

  const filtered = useMemo(() => {
    let list = jadwal;
    if (tipeAktif !== "semua") list = list.filter((item) => (item.tipe ?? "ujian") === tipeAktif);
    if (mapelAktif !== "semua") list = list.filter((item) => (item.pelajaran?.trim() || "Umum") === mapelAktif);
    if (cari.trim()) {
      const q = cari.trim().toLowerCase();
      list = list.filter((item) => item.nama_paket.toLowerCase().includes(q));
    }
    const urutanStatus = { berlangsung: 0, mendatang: 1, berakhir: 2 };
    return [...list].sort((a, b) => urutanStatus[a.status] - urutanStatus[b.status]);
  }, [jadwal, tipeAktif, mapelAktif, cari]);

  const adaFilterAktif = tipeAktif !== "semua" || mapelAktif !== "semua" || cari.trim() !== "";

  const resetFilter = () => {
    setTipeAktif("semua");
    setMapelAktif("semua");
    setCari("");
  };

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-heading-dark sm:text-3xl">Ujian & Latihan Saya</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pilih kategori, lalu pilih ujian yang ingin kamu kerjakan.
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <LatihanList />
        {loading ? (
          <div className="space-y-8">
            <CategorySkeleton />
            <div className="h-12 w-full max-w-md animate-pulse rounded-btn bg-neutral" />
            <div className="grid gap-5 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {sedangBerlangsung.length > 0 && (
              <div className="flex items-center gap-3 rounded-card border border-green-200 bg-green-50 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <PlayCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
                </span>
                <p className="text-sm text-green-800">
                  <span className="font-bold">{sedangBerlangsung.length} ujian sedang berlangsung</span>{" "}
                  sekarang. Lihat yang bertanda hijau di bawah.
                </p>
              </div>
            )}

            {/* GRID KATEGORI — pola utama navigasi bisadanedu.com:
                ikon besar + label singkat, jadi pengguna cukup "tap gambar". */}
            {tipeList.length > 2 && (
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Pilih Kategori</p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {tipeList.map((tipe) => {
                    const Icon = tipeIcon(tipe.value);
                    const aktif = tipeAktif === tipe.value;
                    return (
                      <button
                        key={tipe.value}
                        type="button"
                        onClick={() => setTipeAktif(tipe.value)}
                        aria-pressed={aktif}
                        className={`flex flex-col items-center gap-2 rounded-card border p-4 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:scale-[0.97] ${
                          aktif
                            ? "border-brand-primary bg-brand-primary/5 shadow-sm"
                            : "border-card-border bg-card-bg hover:border-brand-primary/30 hover:bg-brand-primary/5"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-full ${
                            aktif ? "bg-brand-primary text-heading-light" : "bg-neutral text-body-dark"
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className={`text-xs font-semibold ${aktif ? "text-brand-primary" : "text-body-dark"}`}>
                          {tipe.label}
                        </span>
                        <span className="text-[11px] text-text-muted">{tipe.jumlah} tersedia</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pencarian */}
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama ujian..."
                className="w-full rounded-btn border border-card-border bg-card-bg py-3 pl-10 pr-4 text-sm text-body-dark placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            {/* Filter mata pelajaran sebagai dropdown — dilewati kalau cuma 1 opsi */}
            {mapelList.length > 1 && (
              <div className="max-w-xs">
                <label htmlFor="filter-mapel" className="mb-1.5 block text-xs font-semibold text-text-muted">
                  Mata Pelajaran
                </label>
                <select
                  id="filter-mapel"
                  value={mapelAktif}
                  onChange={(e) => setMapelAktif(e.target.value)}
                  className="w-full rounded-btn border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium text-body-dark focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  <option value="semua">Semua Mata Pelajaran</option>
                  {mapelList.map((mapel) => (
                    <option key={mapel} value={mapel}>{mapel}</option>
                  ))}
                </select>
              </div>
            )}

            {adaFilterAktif && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-text-muted">
                  Menampilkan <span className="font-semibold text-body-dark">{filtered.length}</span> dari {jadwal.length} ujian
                </p>
                <button type="button" onClick={resetFilter} className="font-semibold text-brand-primary hover:underline">
                  Hapus Filter
                </button>
              </div>
            )}

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                {tipeAktif === "semua" ? "Semua Ujian" : `${tipeLabel(tipeAktif)} Terbaru`}
              </p>

              {filtered.length === 0 ? (
                <Card>
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral">
                      <Search className="h-5 w-5 text-text-muted" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-heading-dark">Tidak ditemukan</p>
                      <p className="mt-1 text-sm text-text-muted">Coba kata kunci lain atau hapus filter yang aktif.</p>
                    </div>
                    {adaFilterAktif && (
                      <button
                        type="button"
                        onClick={resetFilter}
                        className="mt-1 rounded-btn border border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
                      >
                        Hapus Filter
                      </button>
                    )}
                  </div>
                </Card>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {filtered.map((item) => {
                    const sudahSelesai = jadwalSelesaiSet.has(item.jadwal_ujian_id);
                    const cta = ctaConfig(item.status, sudahSelesai);
                    const CtaIcon = cta.icon;
                    const TipeIcon = tipeIcon(item.tipe ?? "ujian");
                    return (
                      // Seluruh card jadi target klik (gaya bisadanedu: card tryout
                      // langsung mengarah ke halaman detail/kerjakan), tombol di
                      // bawah tetap ada sebagai penegasan visual bagi pengguna awam.
                      <Link
                        key={item.jadwal_ujian_id}
                        href={sudahSelesai ? `/siswa/hasil/${hasilByJadwal.get(item.jadwal_ujian_id)}` : `/siswa/paket/${item.jadwal_ujian_id}`}
                        className={`block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 rounded-card ${
                          item.status === "berlangsung" && !sudahSelesai ? "ring-2 ring-green-400/60" : ""
                        }`}
                      >
                        <Card className="group flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2.5 py-1 text-[11px] font-bold text-brand-primary">
                              <TipeIcon className="h-3 w-3" aria-hidden="true" />
                               {item.nama_grup_tryout || tipeLabel(item.tipe ?? "ujian")} {(item.kategori_nama || item.kategori) ? `· ${item.kategori_nama || item.kategori?.toUpperCase().replace("_", " ")}` : ""}

                            </span>
                            <StatusBadge status={item.status} sudahSelesai={sudahSelesai} />
                          </div>

                          <h2 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-heading-dark">
                            {item.nama_paket}
                          </h2>

                          {item.pelajaran && (
                            <p className="mt-1 text-xs font-medium text-text-muted">{item.pelajaran}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {item.jumlah_soal ?? 0} soal
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {formatDurasi(item.durasi_menit ?? 0)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{formatTanggalRingkas(item.mulai, item.selesai)}</span>
                          </div>

                          <div className="mt-auto pt-4">
                            <span
                              className={`flex w-full items-center justify-center gap-2 rounded-btn px-5 py-3 text-sm font-bold transition-all duration-150 group-active:scale-[0.98] ${cta.cls}`}
                            >
                              <CtaIcon className="h-4 w-4" aria-hidden="true" />
                              {cta.label}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
