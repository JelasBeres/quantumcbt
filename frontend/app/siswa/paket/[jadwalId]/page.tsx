"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Play
} from "lucide-react";

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
  tipe?: "ujian" | "latihan" | string;
  bagian?: { bagian_id: number; nama: string; urutan: number; jumlah_soal?: number }[];
  pelajaran?: string | null;
  deskripsi_paket?: string | null;
};

type Riwayat = {
  ujian_siswa_id: number;
  jadwal_ujian_id?: number | null;
  is_submitted: boolean;
  skor?: number | null;
};

function formatDurasi(menit: number) {
  if (menit < 60) return `${menit} Menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa > 0 ? `${jam} Jam ${sisa} Menit` : `${jam} Jam`;
}

export default function DetailPaketPage() {
  const params = useParams<{ jadwalId: string }>();
  const router = useRouter();
  const jadwalId = Number(params.jadwalId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [jadwal, setJadwal] = useState<Jadwal | null>(null);
  const [activeUjianId, setActiveUjianId] = useState<number | null>(null);
  const [selesaiUjianId, setSelesaiUjianId] = useState<number | null>(null);

  useEffect(() => {
    if (!jadwalId) {
      setLoading(false);
      setError("Jadwal tidak valid.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [jadwalRes, riwayatRes] = await Promise.all([
          api.get("/siswa/jadwal-tersedia"),
          api.get("/siswa/riwayat-ujian")
        ]);

        const jadwalList: Jadwal[] = jadwalRes.data ?? [];
        const found = jadwalList.find((j) => j.jadwal_ujian_id === jadwalId);
        if (!found) {
          setError("Jadwal ujian tidak ditemukan.");
          return;
        }
        setJadwal(found);

        const riwayatList: Riwayat[] = riwayatRes.data ?? [];
        const sameJadwal = riwayatList.filter((r) => r.jadwal_ujian_id === jadwalId);
        const active = sameJadwal.find((r) => !r.is_submitted);
        if (active) setActiveUjianId(active.ujian_siswa_id);
        const selesai = sameJadwal.find((r) => r.is_submitted);
        if (selesai) setSelesaiUjianId(selesai.ujian_siswa_id);
        if (!cancelled && found.tipe === "ujian" && found.status === "berlangsung" && !selesai) {
          setStarting(true);
          const response = await api.post("/ujian-siswa/mulai", { jadwal_ujian_id: found.jadwal_ujian_id, grup_tryout_id: found.grup_tryout_id ?? null });
          router.replace(`/siswa/ujian/${response.data.ujian_siswa_id}`);
        }
      } catch (err) {
        if (!cancelled) { setStarting(false); setError(getErrorMessage(err, "Ujian gagal dimulai.")); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jadwalId, router]);

  const startExam = async () => {
    if (!jadwal) return;
    setStarting(true);
    setError("");
    try {
      const response = await api.post("/ujian-siswa/mulai", {
        jadwal_ujian_id: jadwal.jadwal_ujian_id,
        grup_tryout_id: jadwal.grup_tryout_id ?? null
      });
      router.push(`/siswa/ujian/${response.data.ujian_siswa_id}`);
    } catch (err: any) {
      setError(getErrorMessage(err, "Ujian belum dapat dimulai."));
    } finally {
      setStarting(false);
    }
  };

  const canStart = jadwal?.status === "berlangsung" && activeUjianId === null && selesaiUjianId === null;

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 sm:pt-8">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-card border border-card-border bg-card-bg px-5 py-10 text-center shadow-card">
            <p className="text-sm text-text-muted">Memuat detail ujian...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 sm:pt-8">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/siswa/jadwal-ujian"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke jadwal
        </Link>

        {error && (
          <div className="mt-5 rounded-input border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {jadwal && (
          <div className="mt-5 overflow-hidden rounded-card border border-card-border bg-card-bg shadow-card">
            <div className="border-b border-card-border p-6">
              {jadwal.nama_grup_tryout && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                  {jadwal.nama_grup_tryout}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-heading-dark">
                  {jadwal.nama_paket}
                </h1>
                <div className="flex items-center gap-2">
                  <TipeBadge tipe={jadwal.tipe} />
                  <StatusBadge status={jadwal.status} sudahSelesai={selesaiUjianId !== null} />
                </div>
              </div>
              {jadwal.deskripsi_paket && <p className="mt-2 text-sm leading-relaxed text-text-muted">{jadwal.deskripsi_paket}</p>}
            </div>

            <div className="grid gap-x-6 gap-y-5 p-6 sm:grid-cols-2">
              <InfoItem icon={BookOpen} label="Mata Pelajaran" value={jadwal.pelajaran || "-"} />
              <InfoItem icon={FileText} label="Jumlah Soal" value={`${jadwal.jumlah_soal ?? 0} soal`} />
              <InfoItem icon={Clock3} label="Durasi" value={formatDurasi(jadwal.durasi_menit ?? 0)} />
              <InfoItem
                icon={CalendarClock}
                label="Jadwal"
                value={`${new Date(jadwal.mulai).toLocaleString("id-ID")} – ${new Date(jadwal.selesai).toLocaleString("id-ID")}`}
              />
            </div>

            {jadwal.bagian && jadwal.bagian.length > 0 && (
              <div className="border-t border-card-border p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Bagian Ujian</p>
                <div className="mt-3 space-y-2">
                  {jadwal.bagian.map((bagian) => (
                    <div
                      key={bagian.bagian_id}
                      className="flex items-center justify-between rounded-input bg-neutral px-4 py-2.5 text-sm"
                    >
                      <span className="font-semibold text-heading-dark">{bagian.urutan}. {bagian.nama}</span>
                      <span className="text-xs text-text-muted">{bagian.jumlah_soal} soal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-card-border p-6">
              {selesaiUjianId !== null ? (
                <Link
                  href={`/siswa/hasil/${selesaiUjianId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-btn border border-green-200 bg-green-50 px-5 py-3 text-sm font-bold text-green-700 shadow-none transition hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Selesai · Lihat Hasil
                </Link>
              ) : activeUjianId !== null ? (
                <Link
                  href={`/siswa/ujian/${activeUjianId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-btn bg-cta px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cta/20 transition hover:bg-cta-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Lanjutkan Ujian
                </Link>
              ) : canStart ? (
                <button
                  onClick={startExam}
                  disabled={starting}
                  className="flex w-full items-center justify-center gap-2 rounded-btn bg-cta px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cta/20 transition hover:bg-cta-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {starting ? "Menyiapkan..." : "Mulai Ujian"}
                </button>
              ) : jadwal.status === "mendatang" ? (
                <div className="flex items-center justify-center gap-2 rounded-input bg-neutral px-5 py-3 text-sm font-semibold text-text-muted">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Belum Dimulai · {new Date(jadwal.mulai).toLocaleString("id-ID")}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-input bg-neutral px-5 py-3 text-sm font-semibold text-text-muted">
                  Jadwal telah berakhir
                </div>
              )}

              {activeUjianId !== null && selesaiUjianId === null && (
                <p className="mt-3 text-center text-xs text-text-muted">
                  Kamu sudah pernah memulai ujian ini. Lanjutkan dari soal terakhirmu.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-bold leading-snug text-heading-dark">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, sudahSelesai }: { status: Jadwal["status"]; sudahSelesai?: boolean }) {
  if (sudahSelesai) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
        Selesai
      </span>
    );
  }
  const config = {
    berlangsung: { label: "Berlangsung", cls: "border border-green-200 bg-green-50 text-green-700" },
    mendatang: { label: "Akan Datang", cls: "border border-amber-200 bg-amber-50 text-amber-700" },
    berakhir: { label: "Selesai", cls: "bg-neutral text-text-muted" }
  } as const;
  const c = config[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

function TipeBadge({ tipe }: { tipe?: string }) {
  const t = tipe ?? "ujian";
  const config = {
    latihan: { label: "Latihan", cls: "border border-blue-200 bg-blue-50 text-blue-800" },
    ujian: { label: "Ujian", cls: "bg-neutral text-text-muted" }
  } as const;
  const c = config[t as keyof typeof config] ?? config.ujian;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}
