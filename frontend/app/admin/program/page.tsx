"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Table from "@/components/Table";
import { Program } from "@/lib/types";
import { useAppDialog } from "@/components/Dialog";

export default function ProgramPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { showConfirm, dialog } = useAppDialog();
  const [formData, setFormData] = useState({
    nama: "",
    deskripsi: "",
    is_active: true
  });

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const response = await api.get("/program/");
      setPrograms(response.data);
    } catch (error) {
      console.error("Failed to load programs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/program/${editingId}`, formData);
      } else {
        await api.post("/program/", formData);
      }
      loadPrograms();
      resetForm();
    } catch (error) {
      console.error("Failed to save program:", error);
    }
  };

  const handleEdit = (program: Program) => {
    setFormData({
      nama: program.nama,
      deskripsi: program.deskripsi || "",
      is_active: program.is_active
    });
    setEditingId(program.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: "Hapus Program",
      description: "Program ini akan dihapus dari daftar.",
      confirmLabel: "Hapus Program",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/program/${id}`);
      loadPrograms();
    } catch (error) {
      console.error("Failed to delete program:", error);
    }
  };

  const resetForm = () => {
    setFormData({ nama: "", deskripsi: "", is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const columns = [
    { header: "Nama", accessor: "nama" as keyof Program },
    { header: "Deskripsi", accessor: "deskripsi" as keyof Program },
    {
      header: "Status",
      accessor: (row: Program) => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.is_active ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {row.is_active ? "Aktif" : "Nonaktif"}
        </span>
      )
    },
    {
      header: "Aksi",
      accessor: (row: Program) => (
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
          <h1 className="text-3xl font-bold text-heading-dark">Program</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola program studi dan jurusan</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            Tambah Program
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title={editingId ? "Edit Program" : "Tambah Program"}
          action={
            <Button variant="outline" size="sm" onClick={resetForm}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Program"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: IPA, IPS, Keagamaan"
            />
            <Textarea
              label="Deskripsi"
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              placeholder="Deskripsi program (opsional)"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-body-dark">
                Program Aktif
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {editingId ? "Simpan Perubahan" : "Tambah Program"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table paginate newestFirst searchText={(row) => [row.nama, row.deskripsi].filter(Boolean).join(" ")} data={programs} columns={columns} emptyMessage="Belum ada program" />
      </Card>
      {dialog}
    </div>
  );
}
