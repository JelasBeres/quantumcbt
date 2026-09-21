"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  FilePlus2,
  FileQuestion,
  ShieldAlert,
  Users
} from "lucide-react";
import { api } from "@/lib/api";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

interface DashboardData {
  total_siswa: number;
  total_paket: number;
  total_jadwal: number;
  total_ujian_aktif: number;
  total_ujian_selesai: number;
}

interface Statistik {
  total_jadwal_published: number;
  ujian_berjalan: number;
}

interface Analytics {
  jumlah_hasil: number;
  rata_rata_nilai?: number | null;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [esaiPending, setEsaiPending] = useState(0);
  const [pelanggaran, setPelanggaran] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktif = true;
    async function load() {
      try {
        const [dashboard, stats, hasil, pending, logs] = await Promise.allSettled([
          api.get("/dashboard/admin").then((r) => r.data),
          api.get("/dashboard/statistik").then((r) => r.data),
          api.get("/dashboard/hasil-analytics").then((r) => r.data),
          api.get("/jawaban-siswa/esai/koreksi", { params: { hanya_belum_dinilai: true } }).then((r) => r.data.length),
          api.get("/dashboard/log-kecurangan").then((r) => r.data.length)
        ]);
        if (!aktif) return;
        if (dashboard.status === "fulfilled") setData(dashboard.value);
        if (stats.status === "fulfilled") setStatistik(stats.value);
        if (hasil.status === "fulfilled") setAnalytics(hasil.value);
        if (pending.status === "fulfilled") setEsaiPending(pending.value);
        if (logs.status === "fulfilled") setPelanggaran(logs.value);
      } finally {
        if (aktif) setLoading(false);
      }
    }
    load();
    return () => { aktif = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-8 w-56" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const berjalan = statistik?.ujian_berjalan ?? data?.total_ujian_aktif ?? 0;
  const perhatian = [
    esaiPending > 0 && {
      title: `${esaiPending} jawaban esai belum dikoreksi`,
      description: "Beri nilai agar hasil akhir siswa segera tersedia.",
      href: "/admin/koreksi-esai",
      label: "Koreksi sekarang"
    },
    pelanggaran > 0 && {
      title: `${pelanggaran} aktivitas mencurigakan tercatat`,
      description: "Periksa siswa yang berpindah tab selama ujian.",
      href: "/admin/monitoring-ujian",
      label: "Lihat log"
    },
    (data?.total_paket ?? 0) === 0 && {
      title: "Belum ada paket ujian",
      description: "Buat paket, pilih soal, lalu tentukan jadwal penerbitan.",
      href: "/admin/paket-ujian",
      label: "Buat paket"
    }
  ].filter(Boolean) as { title: string; description: string; href: string; label: string }[];

  const summaries = [
    { label: "Ujian berjalan", value: berjalan, href: "/admin/monitoring-ujian", icon: Activity },
    { label: "Peserta terdaftar", value: data?.total_siswa ?? 0, href: "/admin/siswa", icon: Users },
    { label: "Esai menunggu nilai", value: esaiPending, href: "/admin/koreksi-esai", icon: FileQuestion },
    { label: "Pelanggaran tercatat", value: pelanggaran, href: "/admin/monitoring-ujian", icon: ShieldAlert }
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Ringkasan hari ini</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Dashboard Admin</h1>
          <p className="mt-1 text-sm text-text-muted">Mulai pekerjaan utama dari sini; data master tersedia di menu.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" /> Sistem online
        </span>
      </header>

      {data && data.total_paket === 0 && data.total_siswa === 0 && (
        <section className="rounded-xl border-2 border-brand-primary/20 bg-card-bg p-6">
          <h2 className="text-lg font-bold text-heading-dark">Selamat datang! Mulai dari sini</h2>
          <p className="mt-1 text-sm text-text-muted">Ikuti tiga langkah singkat ini untuk menyiapkan ujian pertama kamu.</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            <li className="rounded-lg border border-card-border p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-heading-light">1</span>
              <p className="mt-2 font-semibold text-body-dark">Lengkapi data dasar</p>
              <p className="text-sm text-text-muted">Buat <b>Pelajaran</b> dan <b>Kelas</b> dari menu Bank Soal.</p>
            </li>
            <li className="rounded-lg border border-card-border p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-heading-light">2</span>
              <p className="mt-2 font-semibold text-body-dark">Tulis soal</p>
              <p className="text-sm text-text-muted">Tulis soal, pilihan, dan kunci jawaban di menu <b>Tambah Soal</b>.</p>
            </li>
            <li className="rounded-lg border border-card-border p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-heading-light">3</span>
              <p className="mt-2 font-semibold text-body-dark">Buat ujian & jadwalkan</p>
              <p className="text-sm text-text-muted">Buka menu <b>Ujian</b> lalu atur jadwalnya.</p>
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/tambah-soal" className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-heading-light hover:bg-brand-primary-light">Mulai tulis soal</Link>
            <Link href="/admin/pelajaran" className="rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-body-dark hover:border-brand-primary">Buat pelajaran</Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="group transition hover:opacity-90">
            <StatCard label={label} value={value} icon={<Icon className="h-4 w-4" aria-hidden="true" />} />
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/paket-ujian" className="group rounded-card bg-brand-primary p-6 text-heading-light shadow-card transition hover:bg-brand-primary-light hover:shadow-card-hover">
          <div className="flex items-start justify-between gap-4">
            <div>
              <FilePlus2 className="h-7 w-7" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-bold">Buat Ujian Baru</h2>
              <p className="mt-1 text-sm text-body-light">Buat paket, pilih soal dari bank, lalu lanjutkan ke jadwal.</p>
            </div>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" />
          </div>
        </Link>
        <Link href="/admin/tambah-soal" className="group rounded-card border border-card-border bg-card-bg p-6 shadow-card transition hover:border-brand-primary hover:shadow-card-hover">
          <div className="flex items-start justify-between gap-4">
            <div>
              <FileQuestion className="h-7 w-7 text-brand-primary" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-bold text-heading-dark">Buat Soal Baru</h2>
              <p className="mt-1 text-sm text-text-muted">Tulis soal, rumus, pilihan, dan kunci jawaban dalam satu formulir.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-brand-primary transition group-hover:translate-x-1" aria-hidden="true" />
          </div>
        </Link>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card title="Perlu Perhatian">
          {perhatian.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
              title="Tidak ada pekerjaan mendesak"
              description="Semua proses penting sudah tertangani."
            />
          ) : (
            <div className="divide-y divide-card-border">
              {perhatian.map((item) => (
                <div key={item.title} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-heading-dark">{item.title}</p>
                    <p className="text-sm text-text-muted">{item.description}</p>
                  </div>
                  <Link href={item.href} className="text-sm font-semibold text-brand-primary hover:underline">{item.label}</Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Ringkasan Sistem">
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Paket ujian</dt><dd className="font-bold text-heading-dark">{data?.total_paket ?? 0}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Jadwal terbit</dt><dd className="font-bold text-heading-dark">{statistik?.total_jadwal_published ?? 0}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Ujian selesai</dt><dd className="font-bold text-heading-dark">{data?.total_ujian_selesai ?? 0}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-text-muted">Rata-rata nilai</dt><dd className="font-bold text-heading-dark">{analytics?.rata_rata_nilai != null ? analytics.rata_rata_nilai.toFixed(1) : "-"}</dd></div>
          </dl>
          <Link href="/admin/jadwal-ujian" className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-card-border px-3 py-2 text-sm font-semibold text-body-dark transition hover:border-brand-primary hover:text-brand-primary">
            <CalendarClock className="h-4 w-4" aria-hidden="true" /> Kelola jadwal
          </Link>
        </Card>
      </section>
    </div>
  );
}
