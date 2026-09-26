"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, History, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Table from "@/components/Table";
import { LoginActivity } from "@/lib/types";
import ResetFilterButton from "@/components/ResetFilterButton";

export default function LoginActivityPage() {
  const [items, setItems] = useState<LoginActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");

  const load = async (user = username, status = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (user.trim()) params.username = user.trim();
      if (status) params.successful = status;
      const response = await api.get("/login-activity/", { params });
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Log aktivitas login gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const columns = [
    { header: "Username", accessor: "username" as keyof LoginActivity },
    {
      header: "Status",
      accessor: (row: LoginActivity) =>
        row.successful ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Berhasil
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
            <XCircle className="h-3 w-3" aria-hidden="true" /> Gagal
          </span>
        )
    },
    { header: "IP Address", accessor: (row: LoginActivity) => row.ip_address || "-" },
    {
      header: "Waktu",
      accessor: (row: LoginActivity) => new Date(row.created_at).toLocaleString("id-ID")
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading-dark">Log Aktivitas Login</h1>
        <p className="mt-1 text-sm text-text-muted">Riwayat percobaan login ke sistem</p>
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Input
            label="Cari username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            placeholder="Ketik username..."
            className="max-w-xs"
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-body-dark">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "true" | "false")}
              className="rounded-input border border-card-border bg-card-bg px-4 py-2 text-sm text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
            >
              <option value="">Semua</option>
              <option value="true">Berhasil</option>
              <option value="false">Gagal</option>
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => load()}>
            Cari
          </Button>
          <ResetFilterButton active={Boolean(username || statusFilter)} onReset={() => { setUsername(""); setStatusFilter(""); void load("", ""); }} />
        </div>

        {loading ? (
          <p className="py-8 text-center text-text-muted">Memuat...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-text-muted">
            <History className="h-8 w-8" aria-hidden="true" />
            <p className="mt-2 text-sm">Belum ada aktivitas login.</p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-text-muted">{items.length} aktivitas login</p>
            <Table data={items} columns={columns} emptyMessage="Belum ada aktivitas login" scrollHeight="max-h-[65vh]" />
          </>
        )}
      </Card>
    </div>
  );
}
