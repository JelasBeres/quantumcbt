"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  kategori_id?: number | null;
  kategori_nama?: string | null;
};

type LogKecurangan = {
  id: number;
  ujian_siswa_id: number;
  siswa_id?: number | null;
  nama_siswa?: string | null;
  tipe_kecurangan?: string | null;
  deskripsi?: string | null;
  created_at?: string | null;
  paket_ujian_id?: number | null;
  nama_paket?: string | null;
  kategori_id?: number | null;
  kategori_nama?: string | null;
};

const kategoriKey = (item: { kategori_id?: number | null }) => item.kategori_id != null ? String(item.kategori_id) : "none";

const emptyLogFilter = { q: "", tipe: "", paket: "", from: "", to: "" };
const inputClass = "mt-1 block w-full rounded-input border border-card-border bg-card-bg px-3 py-2 text-sm text-body-dark outline-none focus:border-brand-primary";

function labelTipe(tipe?: string | null) {
  if (tipe === "tab_blur") return "Pindah tab / jendela";
  return tipe ? tipe.replace(/_/g, " ") : "-";
}

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
  const [filter, setFilter] = useState({ q: "", status: "", paket: "" });
  const [logFilter, setLogFilter] = useState(emptyLogFilter);
  const [kategori, setKategori] = useState("");
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

  const kategoriGroups = useMemo(() => {
    const groups = new Map<string, { label: string; total: number; sedang: number }>();
    monitoring.forEach((item) => { const key = kategoriKey(item); const group = groups.get(key) ?? { label: item.kategori_nama || "Tanpa Kategori", total: 0, sedang: 0 }; group.total += 1; if (item.status === "sedang") group.sedang += 1; groups.set(key, group); });
    return Array.from(groups.entries()).sort((a, b) => a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].label.localeCompare(b[1].label));
  }, [monitoring]);
  const scopedMonitoring = useMemo(() => kategori ? monitoring.filter((item) => kategoriKey(item) === kategori) : monitoring, [kategori, monitoring]);
  const scopedLogs = useMemo(() => kategori ? logs.filter((log) => kategoriKey(log) === kategori) : logs, [kategori, logs]);
  const selectKategori = (key: string) => { setKategori(key); setFilter((current) => ({ ...current, paket: "" })); setLogFilter((current) => ({ ...current, paket: "" })); };

  const sedangBerlangsung = scopedMonitoring.filter((m) => m.status === "sedang").length;
  const pelanggaran = scopedLogs.filter((l) => l.tipe_kecurangan === "tab_blur").length;
  const paketOptions = useMemo(() => Array.from(new Map(scopedMonitoring.map((item) => [item.paket_ujian_id, item.nama_paket])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [scopedMonitoring]);
  const filteredMonitoring = useMemo(() => {
    const query = filter.q.trim().toLowerCase();
    return scopedMonitoring.filter((item) =>
      (!query || `${item.nama_siswa} ${item.nama_paket}`.toLowerCase().includes(query)) &&
      (!filter.status || item.status === filter.status) &&
      (!filter.paket || String(item.paket_ujian_id) === filter.paket)
    );
  }, [filter, scopedMonitoring]);

  const paketByUjian = useMemo(() => new Map(monitoring.map((item) => [item.ujian_siswa_id, item])), [monitoring]);
  const tipeOptions = useMemo(() => Array.from(new Set(scopedLogs.map((l) => l.tipe_kecurangan).filter((t): t is string => !!t))).sort(), [scopedLogs]);
  const filteredLogs = useMemo(() => {
    const query = logFilter.q.trim().toLowerCase();
    const from = logFilter.from ? new Date(`${logFilter.from}T00:00:00`).getTime() : null;
    const to = logFilter.to ? new Date(`${logFilter.to}T23:59:59.999`).getTime() : null;
    return scopedLogs.filter((log) => {
      const ujian = paketByUjian.get(log.ujian_siswa_id);
      const time = log.created_at ? new Date(log.created_at).getTime() : NaN;
      return (!query || `${log.nama_siswa ?? ""} ${log.deskripsi ?? ""} ${log.nama_paket ?? ujian?.nama_paket ?? ""}`.toLowerCase().includes(query)) &&
        (!logFilter.tipe || log.tipe_kecurangan === logFilter.tipe) &&
        (!logFilter.paket || String(log.paket_ujian_id ?? ujian?.paket_ujian_id) === logFilter.paket) &&
        (from === null || (Number.isFinite(time) && time >= from)) &&
        (to === null || (Number.isFinite(time) && time <= to));
    });
  }, [logFilter, scopedLogs, paketByUjian]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Monitoring Ujian</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pantau tryout/ujian berjalan per kategori dan deteksi kecurangan. Latihan mandiri tidak ditampilkan. Terakhir update {lastUpdate || "-"}
          </p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {kategoriGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-card-border pb-3" aria-label="Kategori ujian">
          {[["", { label: "Semua Kategori", total: monitoring.length, sedang: monitoring.filter((m) => m.status === "sedang").length }] as const, ...kategoriGroups].map(([key, group]) => (
            <button key={key || "all"} type="button" onClick={() => selectKategori(key)} aria-pressed={kategori === key} className={`rounded-btn border px-3 py-2 text-left text-sm font-semibold transition ${kategori === key ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-card-border bg-card-bg text-text-muted hover:text-body-dark"}`}>
              {group.label} ({group.total}){group.sedang > 0 && <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">{group.sedang} berjalan</span>}
            </button>
          ))}
        </div>
      )}

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
              <p className="text-2xl font-bold text-heading-dark">{scopedMonitoring.length}</p>
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
        <div className="mb-4 grid gap-3 rounded-input border border-card-border bg-neutral/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
          <label className="text-sm font-medium text-body-dark">
            Cari siswa atau paket
            <input value={filter.q} onChange={(event) => setFilter({ ...filter, q: event.target.value })} placeholder="Ketik nama..." className="mt-1 block w-full rounded-input border border-card-border bg-card-bg px-3 py-2 text-sm text-body-dark outline-none focus:border-brand-primary" />
          </label>
          <label className="text-sm font-medium text-body-dark">
            Status
            <select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })} className="mt-1 block w-full rounded-input border border-card-border bg-card-bg px-3 py-2 text-sm text-body-dark outline-none focus:border-brand-primary">
              <option value="">Semua status</option><option value="sedang">Sedang berlangsung</option><option value="timeout">Waktu habis</option><option value="selesai">Selesai</option>
            </select>
          </label>
          <label className="text-sm font-medium text-body-dark">
            Paket ujian
            <select value={filter.paket} onChange={(event) => setFilter({ ...filter, paket: event.target.value })} className="mt-1 block w-full rounded-input border border-card-border bg-card-bg px-3 py-2 text-sm text-body-dark outline-none focus:border-brand-primary">
              <option value="">Semua paket</option>{paketOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
            </select>
          </label>
          <Button variant="outline" className="self-end" onClick={() => setFilter({ q: "", status: "", paket: "" })}>Reset</Button>
        </div>
        {loading ? (
          <p className="py-8 text-center text-text-muted">Memuat...</p>
        ) : scopedMonitoring.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Belum ada peserta yang mengerjakan tryout/ujian.</p>
        ) : filteredMonitoring.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Tidak ada data yang sesuai filter.</p>
        ) : (
          <>
          <p className="mb-3 text-xs text-text-muted">Menampilkan {filteredMonitoring.length} dari {scopedMonitoring.length} peserta</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4">Siswa</th>
                  <th className="py-2 pr-4">Paket</th>
                  <th className="py-2 pr-4">Kategori</th>
                  <th className="py-2 pr-4">Progres</th>
                  <th className="py-2 pr-4">Ragu-ragu</th>
                  <th className="py-2 pr-4">Sisa Waktu</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonitoring.map((m) => (
                  <tr key={m.ujian_siswa_id} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-body-dark">{m.nama_siswa}</td>
                    <td className="py-2 pr-4 text-body-dark">{m.nama_paket}</td>
                    <td className="py-2 pr-4 text-text-muted">{m.kategori_nama || "-"}</td>
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
          </>
        )}
      </Card>

      <Card title="Log Kecurangan">
        <div className="mb-4 grid gap-3 rounded-input border border-card-border bg-neutral/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_200px_150px_150px_auto]">
          <label className="text-sm font-medium text-body-dark sm:col-span-2 lg:col-span-1">
            Cari siswa, paket, atau keterangan
            <input value={logFilter.q} onChange={(event) => setLogFilter({ ...logFilter, q: event.target.value })} placeholder="Ketik kata kunci..." className={inputClass} />
          </label>
          <label className="text-sm font-medium text-body-dark">
            Jenis
            <select value={logFilter.tipe} onChange={(event) => setLogFilter({ ...logFilter, tipe: event.target.value })} className={inputClass}>
              <option value="">Semua jenis</option>{tipeOptions.map((tipe) => <option key={tipe} value={tipe}>{labelTipe(tipe)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-body-dark">
            Paket ujian
            <select value={logFilter.paket} onChange={(event) => setLogFilter({ ...logFilter, paket: event.target.value })} className={inputClass}>
              <option value="">Semua paket</option>{paketOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-body-dark">
            Dari tanggal
            <input type="date" value={logFilter.from} onChange={(event) => setLogFilter({ ...logFilter, from: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-body-dark">
            Sampai tanggal
            <input type="date" value={logFilter.to} onChange={(event) => setLogFilter({ ...logFilter, to: event.target.value })} className={inputClass} />
          </label>
          <Button variant="outline" className="self-end" onClick={() => setLogFilter(emptyLogFilter)}>Reset</Button>
        </div>
        {scopedLogs.length > 0 && <p className="mb-3 text-xs text-text-muted">Menampilkan {filteredLogs.length} dari {scopedLogs.length} log</p>}
        {scopedLogs.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-text-muted">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            <p className="mt-2 text-sm">Tidak ada kecurangan yang terdeteksi.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Tidak ada log yang sesuai filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4">Siswa</th>
                  <th className="py-2 pr-4">Paket</th>
                  <th className="py-2 pr-4">Jenis</th>
                  <th className="py-2 pr-4">Keterangan</th>
                  <th className="py-2">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-body-dark">{l.nama_siswa || "-"}</td>
                    <td className="py-2 pr-4 text-body-dark">{l.nama_paket || paketByUjian.get(l.ujian_siswa_id)?.nama_paket || "-"}</td>
                    <td className="py-2 pr-4 text-text-muted">{labelTipe(l.tipe_kecurangan)}</td>
                    <td className="py-2 pr-4 text-text-muted">{l.deskripsi || "-"}</td>
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
