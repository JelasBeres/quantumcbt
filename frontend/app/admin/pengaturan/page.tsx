"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Table from "@/components/Table";
import { Pengaturan } from "@/lib/types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export default function PengaturanPage() {
  const [items, setItems] = useState<Pengaturan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({ key: "", value: "" });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const response = await api.get("/pengaturan/");
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Pengaturan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const parsedValue = parseValue(formData.value);
      if (editingKey) {
        await api.put(`/pengaturan/${encodeURIComponent(editingKey)}`, { value: parsedValue });
      } else {
        await api.post("/pengaturan/", { key: formData.key, value: parsedValue });
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Pengaturan gagal disimpan.");
    }
  };

  const handleEdit = (item: Pengaturan) => {
    setEditingKey(item.key);
    setFormData({ key: item.key, value: formatValue(item.value) });
    setShowForm(true);
  };

  const quickSave = async (item: Pengaturan, rawValue: string) => {
    setSavingKey(item.key);
    setError("");
    try {
      await api.put(`/pengaturan/${encodeURIComponent(item.key)}`, { value: parseValue(rawValue) });
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Pengaturan gagal disimpan.");
    } finally {
      setSavingKey(null);
    }
  };

  const resetForm = () => {
    setFormData({ key: "", value: "" });
    setEditingKey(null);
    setShowForm(false);
  };

  const columns = [
    { header: "Key", accessor: (row: Pengaturan) => <span className="font-mono text-sm">{row.key}</span> },
    {
      header: "Value",
      accessor: (row: Pengaturan) => {
        const draft = formatValue(row.value);
        return (
          <input
            defaultValue={draft}
            key={row.key + draft}
            onBlur={(e) => {
              if (e.target.value !== draft) quickSave(row, e.target.value);
            }}
            disabled={savingKey === row.key}
            className="w-full min-w-[180px] rounded-input border border-card-border bg-card-bg px-3 py-1.5 text-sm text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
          />
        );
      }
    },
    {
      header: "Aksi",
      accessor: (row: Pengaturan) => (
        <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
          Edit
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Pengaturan</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola konfigurasi sistem (key-value)</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            Tambah Pengaturan
          </Button>
        )}
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {showForm && (
        <Card
          title={editingKey ? `Edit Pengaturan — ${editingKey}` : "Tambah Pengaturan"}
          action={
            <Button variant="outline" size="sm" onClick={resetForm}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Key"
              required
              disabled={!!editingKey}
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="Contoh: nama_lembaga, durasi_default_menit"
            />
            <Input
              label="Value"
              required
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder='Teks biasa, angka, true/false, atau JSON: {"a":1}'
            />
            <p className="text-xs text-text-muted">
              Value bisa berupa teks biasa, angka, true/false, atau JSON (object/array). Jika tidak berupa JSON valid, akan disimpan sebagai teks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {editingKey ? "Simpan Perubahan" : "Tambah Pengaturan"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table data={items.map((i) => ({ ...i, id: i.id }))} columns={columns} emptyMessage="Belum ada pengaturan" />
      </Card>
    </div>
  );
}
