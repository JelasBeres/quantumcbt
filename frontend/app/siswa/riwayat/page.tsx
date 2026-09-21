"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import Card from "@/components/Card";

type Riwayat = {
  ujian_siswa_id: number;
  nama_paket: string;
  started_at?: string | null;
  finished_at?: string | null;
  is_submitted: boolean;
  skor?: number | null;
  metode_penilaian?: "biasa" | "kohort";
  kohort_status?: "sementara" | "final" | "kosong" | null;
  skala?: "utbk" | "tka" | null;
  nama_grup_tryout?: string | null;
};

type StatusRingkasan = { benar: number; salah: number; kosong: number };

function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function RiwayatPage() {
  const [items, setItems] = useState<Riwayat[]>([]);
  const [ringkasan, setRingkasan] = useState<Record<number, StatusRingkasan>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/siswa/riwayat-ujian");
        const submitted = (response.data as Riwayat[]).filter((item) => item.is_submitted);
        if (cancelled) return;
        setItems(submitted);

        const summaries: Record<number, StatusRingkasan> = {};
        await Promise.all(
          submitted.map(async (item) => {
            try {
              const detail = await api.get(`/hasil-ujian/ujian/${item.ujian_siswa_id}/detail`);
              const soal: any[] = detail.data?.soal ?? [];
              summaries[item.ujian_siswa_id] = {
                benar: soal.filter((s) => {
                  if (s.jawaban_user == null) return false;
                  return s.is_correct === true;
                }).length,
                salah: soal.filter((s) => {
                  if (s.jawaban_user == null) return false;
                  return s.is_correct === false;
                }).length,
                kosong: soal.filter((s) => s.jawaban_user == null).length
              };
            } catch {
              summaries[item.ujian_siswa_id] = { benar: 0, salah: 0, kosong: 0 };
            }
          })
        );
        if (!cancelled) setRingkasan(summaries);
      } catch (err: any) {
        if (!cancelled) setError(getErrorMessage(err, "Riwayat ujian belum bisa dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Ujian Siswa</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Riwayat Pengerjaan</h1>
          <p className="mt-1 text-sm text-text-muted">Setiap ujian yang pernah kamu selesaikan tersimpan di sini.</p>
        </div>
        {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? (
          <Card><p className="text-sm text-text-muted">Memuat riwayat...</p></Card>
        ) : items.length === 0 ? (
          <Card>
            <div className="py-10 text-center">
              <History className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
              <p className="mt-3 text-text-muted">Belum ada ujian yang selesai.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const ringkas = ringkasan[item.ujian_siswa_id];
              return (
                <Card key={item.ujian_siswa_id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-brand-primary">{item.nama_grup_tryout || "Tanpa grup"}</p>
                      <h2 className="mt-1 truncate text-lg font-bold text-heading-dark">{item.nama_paket}</h2>
                      <p className="mt-1 text-sm text-text-muted">
                        Selesai {formatTanggal(item.finished_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {ringkas && (
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span className="font-semibold text-green-700">✓ {ringkas.benar} benar</span>
                          <span className="font-semibold text-red-700">× {ringkas.salah} salah</span>
                          <span className="font-semibold text-text-muted">○ {ringkas.kosong} kosong</span>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-text-muted">{item.metode_penilaian === "kohort" ? `Benchmark Kohort · ${(item.skala ?? "utbk").toUpperCase()}` : "Nilai Biasa"}</p>
                        <p className="text-2xl font-bold text-brand-primary">{item.skor != null ? item.skor.toFixed(item.metode_penilaian === "kohort" ? 0 : 1) : "Belum tersedia"}</p>
                        {item.metode_penilaian === "kohort" && item.kohort_status === "sementara" && <p className="text-xs font-semibold text-amber-700">Sementara</p>}
                      </div>
                      <Link
                        href={`/siswa/hasil/${item.ujian_siswa_id}`}
                        className="rounded-btn border border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-heading-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                      >
                        Lihat Hasil
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
