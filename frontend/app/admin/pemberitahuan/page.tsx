"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import Table from "@/components/Table";
import { useAppDialog } from "@/components/Dialog";
import { Kelas, Program } from "@/lib/types";
import { JENIS_LABEL, JenisPemberitahuan, PemberitahuanAdmin } from "@/lib/pemberitahuan";

type FormState = {
  judul: string;
  isi: string;
  jenis: JenisPemberitahuan;
  tautan: string;
  program_id: string;
  kelas_id: string;
  berlaku_sampai: string;
  tampil_popup: boolean;
  is_active: boolean;
};

const FORM_KOSONG: FormState = {
  judul: "",
  isi: "",
  jenis: "promo",
  tautan: "",
  program_id: "",
  kelas_id: "",
  berlaku_sampai: "",
  tampil_popup: true,
  is_active: true,
};

const JENIS_WARNA: Record<JenisPemberitahuan, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  promo: "border-amber-200 bg-amber-50 text-amber-700",
  paket_baru: "border-green-200 bg-green-50 text-green-700",
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function AdminPemberitahuanPage() {
  const [rows, setRows] = useState<PemberitahuanAdmin[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showConfirm, dialog } = useAppDialog();

  const load = async () => {
    try {
      const [notif, prog, kls] = await Promise.all([
        api.get<PemberitahuanAdmin[]>("/pemberitahuan/"),
        api.get<Program[]>("/program/"),
        api.get<Kelas[]>("/kelas/"),
      ]);
      setRows(notif.data);
      setPrograms(prog.data);
      setKelas(kls.data);
    } catch (e) {
      setError(getErrorMessage(e, "Pemberitahuan gagal dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setForm(FORM_KOSONG);
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (row: PemberitahuanAdmin) => {
    setForm({
      judul: row.judul,
      isi: row.isi ?? "",
      jenis: row.jenis,
      tautan: row.tautan ?? "",
      program_id: row.program_id ? String(row.program_id) : "",
      kelas_id: row.kelas_id ? String(row.kelas_id) : "",
      berlaku_sampai: row.berlaku_sampai ? toLocalDateTime(row.berlaku_sampai) : "",
      tampil_popup: row.tampil_popup,
      is_active: row.is_active,
    });
    setEditingId(row.id);
    setShowForm(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      judul: form.judul,
      isi: form.isi.trim() || null,
      jenis: form.jenis,
      tautan: form.tautan.trim() || null,
      program_id: form.program_id ? Number(form.program_id) : null,
      kelas_id: form.kelas_id ? Number(form.kelas_id) : null,
      berlaku_sampai: form.berlaku_sampai ? new Date(form.berlaku_sampai).toISOString() : null,
      tampil_popup: form.tampil_popup,
      is_active: form.is_active,
    };
    try {
      if (editingId) await api.put(`/pemberitahuan/${editingId}`, payload);
      else await api.post("/pemberitahuan/", payload);
      resetForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Pemberitahuan gagal disimpan."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: PemberitahuanAdmin) => {
    try {
      await api.put(`/pemberitahuan/${row.id}`, {
        judul: row.judul,
        isi: row.isi ?? null,
        jenis: row.jenis,
        tautan: row.tautan ?? null,
        program_id: row.program_id ?? null,
        kelas_id: row.kelas_id ?? null,
        berlaku_sampai: row.berlaku_sampai ?? null,
        tampil_popup: row.tampil_popup,
        is_active: !row.is_active,
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Status gagal diubah."));
    }
  };

  const handleDelete = async (row: PemberitahuanAdmin) => {
    const confirmed = await showConfirm({
      title: "Hapus Pemberitahuan",
      description: `"${row.judul}" akan dihapus dan tidak lagi tampil di siswa.`,
      confirmLabel: "Hapus",
      confirmVariant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/pemberitahuan/${row.id}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Pemberitahuan gagal dihapus."));
    }
  };

  const namaProgram = (id?: number | null) => programs.find((p) => p.id === id)?.nama ?? `Program #${id}`;
  const namaKelas = (id?: number | null) => kelas.find((k) => k.id === id)?.nama ?? `Kelas #${id}`;
  const kedaluwarsa = (row: PemberitahuanAdmin) => !!row.berlaku_sampai && new Date(row.berlaku_sampai).getTime() < Date.now();

  const columns = [
    {
      header: "Pemberitahuan",
      accessor: (row: PemberitahuanAdmin) => (
        <div className="max-w-md">
          <p className="font-semibold text-heading-dark">{row.judul}</p>
          {row.isi && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{row.isi}</p>}
          {row.tautan && <p className="mt-0.5 truncate text-xs text-brand-primary">{row.tautan}</p>}
        </div>
      ),
    },
    {
      header: "Jenis",
      accessor: (row: PemberitahuanAdmin) => (
        <div className="flex flex-col items-start gap-1">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${JENIS_WARNA[row.jenis] ?? JENIS_WARNA.info}`}>{JENIS_LABEL[row.jenis] ?? row.jenis}</span>
          {row.jadwal_ujian_id && <span className="text-[11px] text-text-muted">Otomatis dari jadwal</span>}
        </div>
      ),
    },
    {
      header: "Target",
      accessor: (row: PemberitahuanAdmin) => (
        <span className="text-sm">
          {row.program_id || row.kelas_id
            ? [row.program_id && namaProgram(row.program_id), row.kelas_id && namaKelas(row.kelas_id)].filter(Boolean).join(" · ")
            : "Semua siswa"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: (row: PemberitahuanAdmin) => {
        const [label, warna] = !row.is_active
          ? ["Nonaktif", "border-red-200 bg-red-50 text-red-700"]
          : kedaluwarsa(row)
            ? ["Kedaluwarsa", "border-gray-200 bg-gray-50 text-gray-600"]
            : ["Tayang", "border-green-200 bg-green-50 text-green-700"];
        return (
          <div className="flex flex-col items-start gap-1">
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${warna}`}>{label}</span>
            {row.tampil_popup && <span className="text-[11px] text-text-muted">+ popup</span>}
          </div>
        );
      },
    },
    { header: "Dibaca", accessor: (row: PemberitahuanAdmin) => <span className="text-sm">{row.jumlah_dibaca} siswa</span> },
    {
      header: "Dibuat",
      accessor: (row: PemberitahuanAdmin) => (
        <span className="text-xs text-text-muted">{row.created_at ? new Date(row.created_at).toLocaleString("id-ID") : "-"}</span>
      ),
    },
    {
      header: "Aksi",
      accessor: (row: PemberitahuanAdmin) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>Edit</Button>
          <Button size="sm" variant="outline" onClick={() => handleToggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Hapus</Button>
        </div>
      ),
    },
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
          <h1 className="text-3xl font-bold text-heading-dark">Pemberitahuan Siswa</h1>
          <p className="mt-1 text-sm text-text-muted">
            Kirim promo dan info ke siswa. Paket ujian baru otomatis diberitahukan saat jadwalnya dipublikasikan.
          </p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}>Buat Pemberitahuan</Button>}
      </div>

      {error && !showForm && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <Card
          title={editingId ? "Edit Pemberitahuan" : "Buat Pemberitahuan"}
          action={<Button variant="outline" size="sm" onClick={resetForm}>Batal</Button>}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Judul"
              required
              maxLength={200}
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Contoh: Promo Try Out UTBK diskon 50%"
            />
            <Textarea
              label="Isi"
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
              placeholder="Detail pemberitahuan (opsional)"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Jenis"
                value={form.jenis}
                onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisPemberitahuan })}
                options={[
                  { value: "promo", label: "Promo" },
                  { value: "info", label: "Info" },
                  { value: "paket_baru", label: "Paket Baru" },
                ]}
              />
              <Input
                label="Tautan"
                value={form.tautan}
                maxLength={500}
                onChange={(e) => setForm({ ...form, tautan: e.target.value })}
                placeholder="/siswa/tryout atau https://..."
                helper="Opsional. Tombol “Lihat” di siswa membuka tautan ini."
              />
              <Select
                label="Program"
                value={form.program_id}
                onChange={(e) => setForm({ ...form, program_id: e.target.value })}
                options={[{ value: "", label: "Semua program" }, ...programs.map((p) => ({ value: String(p.id), label: p.nama }))]}
              />
              <Select
                label="Kelas"
                value={form.kelas_id}
                onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}
                options={[{ value: "", label: "Semua kelas" }, ...kelas.map((k) => ({ value: String(k.id), label: k.nama }))]}
              />
              <Input
                label="Tayang sampai"
                type="datetime-local"
                value={form.berlaku_sampai}
                onChange={(e) => setForm({ ...form, berlaku_sampai: e.target.value })}
                helper="Kosongkan agar tayang terus sampai dinonaktifkan."
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-medium text-body-dark">
                <input
                  type="checkbox"
                  checked={form.tampil_popup}
                  onChange={(e) => setForm({ ...form, tampil_popup: e.target.checked })}
                  className="h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary"
                />
                Tampilkan sebagai popup
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-body-dark">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary"
                />
                Aktif
              </label>
            </div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Kirim Pemberitahuan"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table
          paginate
          searchText={(row) => [row.judul, row.isi, JENIS_LABEL[row.jenis]].filter(Boolean).join(" ")}
          data={rows}
          columns={columns}
          emptyMessage="Belum ada pemberitahuan"
        />
      </Card>
      {dialog}
    </div>
  );
}
