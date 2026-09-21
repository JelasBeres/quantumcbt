"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import Card from "@/components/Card";

type Riwayat = {
  ujian_siswa_id: number;
  nama_paket: string;
  started_at?: string | null;
  is_submitted: boolean;
  nama_grup_tryout?: string | null;
};

export default function UjianAktifPage() {
  const [items, setItems] = useState<Riwayat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/siswa/riwayat-ujian")
      .then((response) => setItems(response.data.filter((item: Riwayat) => !item.is_submitted)))
      .catch(() => setError("Daftar ujian aktif belum bisa dimuat."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Ujian Siswa</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Ujian Aktif</h1>
          <p className="mt-1 text-sm text-text-muted">Lanjutkan ujian yang sudah pernah dimulai.</p>
        </div>
        {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? (
          <Card><p className="text-sm text-text-muted">Memuat ujian aktif...</p></Card>
        ) : items.length === 0 ? (
          <Card>
            <div className="py-10 text-center">
              <Activity className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
              <p className="mt-3 font-medium text-heading-dark">Tidak ada ujian aktif</p>
              <Link href="/siswa/jadwal-ujian" className="mt-2 inline-block text-sm font-semibold text-brand-primary">Lihat jadwal ujian</Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map((item) => (
              <Card key={item.ujian_siswa_id}>
                <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">Sedang dikerjakan</span>
                <h2 className="mt-4 text-lg font-bold text-heading-dark">{item.nama_paket}</h2>
                <p className="mt-1 text-sm text-text-muted">{item.nama_grup_tryout || "Tanpa grup"}</p>
                <p className="mt-4 flex items-center gap-2 text-sm text-text-muted">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Mulai {item.started_at ? new Date(item.started_at).toLocaleString("id-ID") : "-"}
                </p>
                <Link href={`/siswa/ujian/${item.ujian_siswa_id}`} className="mt-6 flex items-center justify-center gap-2 rounded-btn bg-cta px-4 py-2 text-sm font-bold text-heading-light shadow-lg shadow-cta/20 transition hover:bg-cta-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2">
                  Lanjutkan Ujian <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
