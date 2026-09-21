"use client";

import { useEffect, useState, FormEvent } from "react";
import { api } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Table from "@/components/Table";
import { useAppDialog } from "@/components/Dialog";

type Kelas = {
  id: number;
  nama: string;
};

export default function KelasPage() {
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nama, setNama] = useState("");
  const { showConfirm, dialog } = useAppDialog();

  useEffect(() => {
    loadKelas();
  }, []);

  const loadKelas = async () => {
    try {
      const response = await api.get("/kelas/");
      setKelas(response.data);
    } catch (error) {
      console.error("Failed to load kelas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/kelas/${editingId}`, { nama });
      } else {
        await api.post("/kelas/", { nama });
      }
      loadKelas();
      resetForm();
    } catch (error) {
      console.error("Failed to save kelas:", error);
    }
  };

  const handleEdit = (item: Kelas) => {
    setNama(item.nama);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: "Hapus Kelas",
      description: "Kelas ini akan dihapus dari daftar.",
      confirmLabel: "Hapus Kelas",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/kelas/${id}`);
      loadKelas();
    } catch (error) {
      console.error("Failed to delete kelas:", error);
    }
  };

  const resetForm = () => {
    setNama("");
    setEditingId(null);
    setShowForm(false);
  };

  const columns = [
    { header: "Nama Kelas", accessor: "nama" as keyof Kelas },
    {
      header: "Aksi",
      accessor: (row: Kelas) => (
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
          <h1 className="text-3xl font-bold text-heading-dark">Kelas</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola kelas</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            Tambah Kelas
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title={editingId ? "Edit Kelas" : "Tambah Kelas"}
          action={
            <Button variant="outline" size="sm" onClick={resetForm}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Kelas"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Kelas 10, Kelas 11, Kelas 12"
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {editingId ? "Simpan Perubahan" : "Tambah Kelas"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table paginate newestFirst searchText={(row) => row.nama} data={kelas} columns={columns} emptyMessage="Belum ada kelas" />
      </Card>
      {dialog}
    </div>
  );
}