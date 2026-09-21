"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ShieldAlert, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import Card from "@/components/Card";
import Button from "@/components/Button";

type Monitoring = {
  ujian_siswa_id: number;
  siswa_id: number;
  nama_siswa: string;
  paket_ujian_id: number;
  nama_paket: string;
  jadwal_ujian_id?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  status: string;
  sisa_waktu_detik: number;
  jumlah_soal?: number;
  terjawab?: number;
  jumlah_ragu?: number;
};

type LogKecurangan = {
  id: number;
  ujian_siswa_id: number;
  siswa_id?: number | null;
  nama_siswa?: string | null;
  tipe_kecurangan?: string | null;
  deskripsi?: string | null;
  created_at?: string | null;
};

function formatSisa(detik: number) {
  const m = Math.floor(detik / 60).toString().padStart(2, "0");
  const s = (detik % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "sedang"
      ? "border border-green-200 bg-green-50 text-green-700"
      : status === "timeout"
        ? "border border-amber-200 bg-amber-50 text-amber-700"
        : "bg-neutral text-body-dark";
  const label = status === "sedang" ? "Sedang berlangsung" : status === "timeout" ? "Waktu habis" : "Selesai";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

export default function MonitoringUjianPage() {
  const [monitoring, setMonitoring] = useState<Monitoring[]>([]);
  const [logs, setLogs] = useState<LogKecurangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const [mRes, lRes] = await Promise.all([
        api.get("/dashboard/monitoring-ujian"),
        api.get("/dashboard/log-kecurangan")
      ]);
      setMonitoring(mRes.data);
      setLogs(lRes.data);
      setLastUpdate(new Date().toLocaleTimeString("id-ID"));
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal memuat data monitoring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, 10000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const sedangBerlangsung = monitoring.filter((m) => m.status === "sedang").length;
  const pelanggaran = logs.filter((l) => l.tipe_kecurangan === "tab_blur").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Monitoring Ujian</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pantau ujian berjalan dan deteksi kecurangan. Terakhir update {lastUpdate || "-"}
          </p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-700"><Activity className="h-6 w-6" aria-hidden="true" /></div>
            <div>
              <p className="text-sm text-text-muted">Sedang Ujian</p>
              <p className="text-2xl font-bold text-heading-dark">{sedangBerlangsung}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><UserCheck className="h-6 w-6" aria-hidden="true" /></div>
            <div>
              <p className="text-sm text-text-muted">Total Peserta Ujian</p>
              <p className="text-2xl font-bold text-heading-dark">{monitoring.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${pelanggaran > 0 ? "bg-amber-100 text-amber-700" : "bg-neutral text-text-muted"}`}><ShieldAlert className="h-6 w-6" aria-hidden="true" /></div>
            <div>
              <p className="text-sm text-text-muted">Kecurangan Terdeteksi</p>
              <p className="text-2xl font-bold text-heading-dark">{pelanggaran}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Ujian Berjalan">
        {loading ? (
          <p className="py-8 text-center text-text-muted">Memuat...</p>
        ) : monitoring.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Belum ada peserta yang mengerjakan ujian.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4">Siswa</th>
                  <th className="py-2 pr-4">Paket</th>
                  <th className="py-2 pr-4">Progres</th>
                  <th className="py-2 pr-4">Ragu-ragu</th>
                  <th className="py-2 pr-4">Sisa Waktu</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {monitoring.map((m) => (
                  <tr key={m.ujian_siswa_id} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-body-dark">{m.nama_siswa}</td>
                    <td className="py-2 pr-4 text-body-dark">{m.nama_paket}</td>
                    <td className="py-2 pr-4 text-text-muted">{m.terjawab ?? 0}/{m.jumlah_soal ?? 0}</td>
                    <td className="py-2 pr-4">
                      {(m.jumlah_ragu ?? 0) > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{m.jumlah_ragu} soal</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 font-semibold tabular-nums ${m.status === "sedang" && m.sisa_waktu_detik <= 300 ? "text-cta" : "text-body-dark"}`}>{formatSisa(m.sisa_waktu_detik)}</td>
                    <td className="py-2"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Log Kecurangan">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-text-muted">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            <p className="mt-2 text-sm">Tidak ada kecurangan yang terdeteksi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4">Siswa</th>
                  <th className="py-2 pr-4">Keterangan</th>
                  <th className="py-2">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-body-dark">{l.nama_siswa || "-"}</td>
                    <td className="py-2 pr-4 text-text-muted">{l.deskripsi || l.tipe_kecurangan || "-"}</td>
                    <td className="py-2 text-text-muted">{l.created_at ? new Date(l.created_at).toLocaleString("id-ID") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
