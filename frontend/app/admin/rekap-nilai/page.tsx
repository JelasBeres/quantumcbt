"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Download, RotateCcw, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Select from "@/components/Select";
import Table from "@/components/Table";
import { PaketUjian } from "@/lib/types";
import ResetFilterButton from "@/components/ResetFilterButton";
import { useAppDialog } from "@/components/Dialog";
import { getUser } from "@/lib/auth";

const kkmOf = (row: { kkm?: number | null }) => row.kkm ?? 75;

type HasilSiswa = {
  hasil_ujian_id: number;
  ujian_siswa_id: number;
  siswa_id: number;
  nama_siswa: string;
  no_induk?: string | null;
  paket_ujian_id: number;
  nama_paket: string;
  jadwal_ujian_id?: number | null;
  skor?: number | null;
  metode_penilaian?: "biasa" | "kohort";
  kohort_status?: "sementara" | "final" | "kosong" | null;
  skala?: "utbk" | "tka" | null;
  skor_mentah?: number | null;
  kkm?: number | null;
  calculated_at?: string | null;
};

export default function RekapNilaiPage() {
  const [paketList, setPaketList] = useState<PaketUjian[]>([]);
  const [selectedPaket, setSelectedPaket] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<(HasilSiswa & { id: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resettingId, setResettingId] = useState<number | null>(null);
  const isAdmin = getUser()?.role === "admin";
  const { showConfirm, dialog } = useAppDialog();

  useEffect(() => {
    api.get("/paket-ujian/")
      .then((r) => setPaketList(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(selectedPaket);
  }, [selectedPaket]);

  const load = async (paketId: string) => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (paketId) params.paket_ujian_id = paketId;
      const res = await api.get("/dashboard/hasil-siswa", { params });
      setRows(res.data.map((r: HasilSiswa) => ({ ...r, id: r.hasil_ujian_id })));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal memuat rekap nilai.");
    } finally {
      setLoading(false);
    }
  };

  const visibleRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter(
          (r) =>
            r.nama_siswa.toLowerCase().includes(keyword) ||
            (r.no_induk || "").toLowerCase().includes(keyword)
        )
      : rows;
    return [...filtered].sort((a, b) => (b.skor ?? -1) - (a.skor ?? -1));
  }, [rows, q]);

  const stats = useMemo(() => {
    const skor = rows.map((r) => r.skor).filter((s): s is number => s != null);
    if (skor.length === 0) return { jumlah: 0, rata: null, tertinggi: null, terendah: null, lulus: 0 };
    const rata = skor.reduce((a, b) => a + b, 0) / skor.length;
    return {
      jumlah: skor.length,
      rata,
      tertinggi: Math.max(...skor),
      terendah: Math.min(...skor),
      // Status lulus (≥ KKM paket) hanya berlaku untuk penilaian biasa (skala 0–100).
      lulus: rows.filter((r) => r.skor != null && r.metode_penilaian !== "kohort" && r.skor >= kkmOf(r)).length
    };
  }, [rows]);

  const downloadExcel = async () => {
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    const ws = wb.addWorksheet("Rekap Nilai");

    const ARGB_BRAND = "FF2D3C8F";
    const ARGB_BRAND_LIGHT = "FF3447A8";
    const ARGB_BORDER = "FFC9D0EA";
    const ARGB_GREEN = "FF16A34A";
    const ARGB_RED = "FFDC2626";
    const ARGB_MUTED = "FF6B7280";

    const thinBorder = {
      top: { style: "thin" as const, color: { argb: ARGB_BORDER } },
      left: { style: "thin" as const, color: { argb: ARGB_BORDER } },
      bottom: { style: "thin" as const, color: { argb: ARGB_BORDER } },
      right: { style: "thin" as const, color: { argb: ARGB_BORDER } }
    };

    ws.columns = [
      { width: 6 },
      { width: 30 },
      { width: 16 },
      { width: 30 },
      { width: 10 },
      { width: 14 }
    ];

    const namaPaket = selectedPaket ? (paketList.find((p) => p.id === Number(selectedPaket))?.nama ?? "Semua ujian") : "Semua ujian";

    // Baris 1: judul
    ws.mergeCells("A1:F1");
    const title = ws.getCell("A1");
    title.value = "Rekap Nilai Ujian";
    title.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB_BRAND } };
    ws.getRow(1).height = 30;

    // Baris 2: sub judul
    ws.mergeCells("A2:F2");
    const sub = ws.getCell("A2");
    sub.value = `${namaPaket}  •  Diunduh ${new Date().toLocaleString("id-ID")}`;
    sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: ARGB_MUTED } };
    sub.alignment = { horizontal: "center", vertical: "middle" };

    // Baris 3: header
    const headerRow = ws.getRow(3);
    const headers = ["No", "Nama Siswa", "No. Induk", "Paket", "Nilai", "Status"];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB_BRAND_LIGHT } };
      cell.border = thinBorder;
    });
    headerRow.height = 22;

    // Baris data
    visibleRows.forEach((r, idx) => {
      const row = ws.getRow(idx + 4);
      const nilai = r.skor != null ? Math.round(r.skor * 10) / 10 : null;
      const lulus = nilai != null && nilai >= kkmOf(r);
      const status = nilai == null ? "Belum tersedia" : r.metode_penilaian === "kohort" ? (r.kohort_status === "final" ? "Final" : "Sementara") : lulus ? "Lulus" : "Belum lulus";

      const values = [idx + 1, r.nama_siswa, r.no_induk || "-", r.nama_paket, nilai ?? "-", status];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E1E1E" } };
        cell.border = thinBorder;
        cell.alignment = i === 0 || i === 4 || i === 5 ? { horizontal: "center", vertical: "middle" } : { vertical: "middle" };
      });

      if (nilai != null && r.metode_penilaian === "kohort") {
        // Skala kohort (200–800 / 0–1000) tidak memakai KKM: tanpa warna lulus/tidak.
        row.getCell(5).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E1E1E" } };
        row.getCell(6).font = { name: "Calibri", size: 10, bold: true, color: { argb: r.kohort_status === "final" ? ARGB_GREEN : ARGB_MUTED } };
      } else if (nilai != null) {
        const nilaiCell = row.getCell(5);
        nilaiCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: lulus ? ARGB_GREEN : ARGB_RED } };
        const statusCell = row.getCell(6);
        statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: lulus ? ARGB_GREEN : ARGB_RED } };
      } else {
        row.getCell(6).font = { name: "Calibri", size: 10, italic: true, color: { argb: ARGB_MUTED } };
      }
    });

    ws.views = [{ state: "frozen", ySplit: 3 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-nilai${selectedPaket ? "-" + selectedPaket : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { header: "No. Induk", accessor: (row: HasilSiswa) => row.no_induk || "-" },
    { header: "Nama Siswa", accessor: "nama_siswa" as keyof HasilSiswa },
    { header: "Paket", accessor: "nama_paket" as keyof HasilSiswa },
    {
      header: "Nilai",
      accessor: (row: HasilSiswa) => (
        <span className={`font-bold ${row.skor == null ? "text-text-muted" : row.metode_penilaian === "kohort" ? "text-heading-dark" : row.skor >= kkmOf(row) ? "text-green-600" : "text-red-600"}`}>
          {row.skor != null ? row.skor.toFixed(row.metode_penilaian === "kohort" ? 0 : 1) : "Belum tersedia"}
        </span>
      )
    },
    {
      header: "Status",
      accessor: (row: HasilSiswa) => {
        if (row.skor == null) return <span className="text-text-muted">Belum tersedia</span>;
        if (row.metode_penilaian === "kohort") return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.kohort_status === "final" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{row.kohort_status === "final" ? "Final" : "Sementara"} · {(row.skala ?? "utbk").toUpperCase()} · Mentah {row.skor_mentah ?? "-"}</span>;
        return row.skor >= kkmOf(row) ? (
          <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">Lulus</span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Belum lulus</span>
        );
      }
    },
    {
      header: "Waktu",
      accessor: (row: HasilSiswa) => (row.calculated_at ? new Date(row.calculated_at).toLocaleString("id-ID") : "-")
    },
    ...(isAdmin ? [{
      header: "Aksi",
      accessor: (row: HasilSiswa) => (
        <button
          type="button"
          onClick={() => resetPengerjaan(row)}
          disabled={resettingId === row.ujian_siswa_id}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {resettingId === row.ujian_siswa_id ? "Mereset..." : "Reset"}
        </button>
      )
    }] : [])
  ];

  async function resetPengerjaan(row: HasilSiswa) {
    const ok = await showConfirm({
      title: "Reset Pengerjaan",
      description: `Pengerjaan ${row.nama_siswa} pada "${row.nama_paket}" akan dihapus (jawaban dan nilai), sehingga siswa bisa mengerjakan ulang selama jadwalnya masih berlangsung. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Reset",
      confirmVariant: "danger"
    });
    if (!ok) return;
    setResettingId(row.ujian_siswa_id);
    setError("");
    setInfo("");
    try {
      const { data } = await api.delete(`/ujian-siswa/${row.ujian_siswa_id}/reset`);
      setInfo(data?.message || "Pengerjaan direset.");
      await load(selectedPaket);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Reset pengerjaan gagal.");
    } finally {
      setResettingId(null);
    }
  }

  const selectedKkm = selectedPaket ? (paketList.find((p) => p.id === Number(selectedPaket))?.kkm ?? 75) : null;
  const summary = [
    { label: "Peserta dinilai", value: String(stats.jumlah), icon: Users },
    { label: "Rata-rata", value: stats.rata != null ? stats.rata.toFixed(1) : "-", icon: Award },
    { label: selectedKkm != null ? `Lulus (≥ KKM ${selectedKkm})` : "Lulus (≥ KKM)", value: String(stats.lulus), icon: TrendingUp },
    { label: "Nilai terendah", value: stats.terendah != null ? stats.terendah.toFixed(1) : "-", icon: TrendingDown }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Rekap Nilai</h1>
          <p className="mt-1 text-sm text-text-muted">Pilih ujian, lihat nilai, lalu unduh laporannya</p>
        </div>
        <Button onClick={downloadExcel} disabled={rows.length === 0}>
          <Download className="h-4 w-4" aria-hidden="true" /> Unduh Excel
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-text-muted">{label}</p>
                <p className="text-xl font-bold text-heading-dark">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-72">
            <Select
              value={selectedPaket}
              onChange={(e) => setSelectedPaket(e.target.value)}
              options={[
                { value: "", label: "Semua ujian" },
                ...paketList.map((p) => ({ value: p.id, label: p.nama }))
              ]}
            />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama siswa..."
              className="w-full rounded-input border border-card-border bg-card-bg py-2 pl-9 pr-3 text-sm text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>
          <ResetFilterButton active={Boolean(selectedPaket || q)} onReset={() => { setSelectedPaket(""); setQ(""); }} />
        </div>

        {error && <div className="mb-4 rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {info && <div className="mb-4 rounded-input border border-green-200 bg-green-50 p-4 text-sm text-green-700">{info}</div>}

        {loading ? (
          <p className="py-8 text-center text-text-muted">Memuat...</p>
        ) : (
          <Table data={visibleRows} columns={columns} emptyMessage="Belum ada hasil ujian" />
        )}
      </Card>
      {dialog}
    </div>
  );
}

