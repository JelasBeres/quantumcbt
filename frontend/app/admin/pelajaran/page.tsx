"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Table from "@/components/Table";
import { Pelajaran, Program } from "@/lib/types";
import { useAppDialog } from "@/components/Dialog";

export default function PelajaranPage() {
  const [pelajaran, setPelajaran] = useState<Pelajaran[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { showConfirm, dialog } = useAppDialog();
  const [formData, setFormData] = useState({
    nama: "",
    program_id: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pelajaranRes, programsRes] = await Promise.all([
        api.get("/pelajaran/"),
        api.get("/program/")
      ]);
      setPelajaran(pelajaranRes.data);
      setPrograms(programsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nama: formData.nama,
        program_id: formData.program_id ? Number(formData.program_id) : null,
        is_active: formData.is_active,
      };
      if (editingId) {
        await api.put(`/pelajaran/${editingId}`, payload);
      } else {
        await api.post("/pelajaran/", payload);
      }
      loadData();
      resetForm();
    } catch (error) {
      console.error("Failed to save pelajaran:", error);
    }
  };

  const handleEdit = (item: Pelajaran) => {
    setFormData({
      nama: item.nama,
      program_id: item.program_id ? String(item.program_id) : "",
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: "Hapus Pelajaran",
      description: "Mata pelajaran ini akan dihapus dari daftar.",
      confirmLabel: "Hapus Pelajaran",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/pelajaran/${id}`);
      loadData();
    } catch (error) {
      console.error("Failed to delete pelajaran:", error);
    }
  };

  const resetForm = () => {
    setFormData({ nama: "", program_id: "", is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const getProgramName = (programId: number | null | undefined) => {
    if (!programId) return "-";
    const program = programs.find(p => p.id === programId);
    return program ? program.nama : "-";
  };

  const columns = [
    { header: "Nama Pelajaran", accessor: "nama" as keyof Pelajaran },
    {
      header: "Program",
      accessor: (row: Pelajaran) => getProgramName(row.program_id)
    },
    {
      header: "Status",
      accessor: (row: Pelajaran) => row.is_active ? "Aktif" : "Nonaktif"
    },
    {
      header: "Aksi",
      accessor: (row: Pelajaran) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>
            Hapus
          </Button>
        </div>
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
          <h1 className="text-3xl font-bold text-heading-dark">Pelajaran</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola mata pelajaran</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            Tambah Pelajaran
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title={editingId ? "Edit Pelajaran" : "Tambah Pelajaran"}
          action={
            <Button variant="outline" size="sm" onClick={resetForm}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Pelajaran"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
            />
            <Select
              label="Program"
              value={formData.program_id}
              onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
              options={[
                { value: "", label: "Semua Program" },
                ...programs.map(p => ({ value: p.id, label: p.nama }))
              ]}
            />
            <label className="flex items-center gap-2 text-sm font-medium text-body-dark">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              Aktif
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {editingId ? "Simpan Perubahan" : "Tambah Pelajaran"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table paginate newestFirst searchText={(row) => [row.nama, getProgramName(row.program_id)].join(" ")} data={pelajaran} columns={columns} emptyMessage="Belum ada pelajaran" />
      </Card>
      {dialog}
    </div>
  );
}
