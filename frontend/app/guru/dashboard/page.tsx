"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, FileQuestion, RefreshCcw } from "lucide-react";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import StatCard from "@/components/StatCard";
import { api } from "@/lib/api";
import { Soal } from "@/lib/types";

type StatusCount = Record<"draft" | "pending_review" | "rejected" | "approved", number>;

export default function GuruDashboardPage() {
  const [counts, setCounts] = useState<StatusCount>({ draft: 0, pending_review: 0, rejected: 0, approved: 0 });
  const [scopes, setScopes] = useState<Array<{ id: number; pelajaran_nama: string; program_nama?: string | null; kelas_nama?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/soal/", { params: { mine: true } }), api.get("/guru-scope/me")])
      .then(([soalRes, scopeRes]) => {
        const next: StatusCount = { draft: 0, pending_review: 0, rejected: 0, approved: 0 };
        (soalRes.data as Soal[]).forEach((item) => {
          const status = item.status as keyof StatusCount;
          if (status in next) next[status] += 1;
        });
        setCounts(next);
        setScopes(scopeRes.data ?? []);
      })
      .catch(() => setError("Dashboard guru gagal dimuat. Silakan muat ulang halaman."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-72" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-brand-primary">Ruang kerja akademik</p>
        <h1 className="mt-1 text-3xl font-bold text-heading-dark">Dashboard Guru</h1>
        <p className="mt-1 text-sm text-text-muted">Kelola soal, bagian paket mapel, dan penilaian sesuai mapel yang Anda ampu.</p>
      </header>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Draft soal" value={counts.draft} icon={<FileQuestion className="h-4 w-4" />} />
        <StatCard label="Menunggu review" value={counts.pending_review} icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Perlu revisi" value={counts.rejected} icon={<RefreshCcw className="h-4 w-4" />} />
        <StatCard label="Soal disetujui" value={counts.approved} icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/guru/soal" className="group rounded-card bg-brand-primary p-6 text-white shadow-card transition hover:bg-brand-primary-light hover:shadow-card-hover">
          <FileQuestion className="h-7 w-7" />
          <h2 className="mt-5 text-xl font-bold">Kelola Soal Saya</h2>
          <p className="mt-1 text-sm text-body-light">Buat draft, ajukan review, dan perbaiki soal dari satu tempat.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Buka soal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
        </Link>
        <Card title="Mapel yang Diampu">
          {scopes.length === 0 ? (
            <p className="text-sm text-text-muted">Belum ada mata pelajaran yang diampu. Hubungi admin.</p>
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-card border border-card-border p-2 pr-1">
              {scopes.map((scope) => (
                <div key={scope.id} className="flex items-start gap-3 rounded-input border border-card-border p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><BookOpen className="h-4 w-4" /></span>
                  <div><p className="text-sm font-bold text-heading-dark">{scope.pelajaran_nama}</p><p className="text-xs text-text-muted">{scope.program_nama || "Semua program"} · {scope.kelas_nama || "Semua kelas"}</p></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
