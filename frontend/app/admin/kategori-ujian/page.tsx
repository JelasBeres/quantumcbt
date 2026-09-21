"use client";

import { FormEvent, useEffect, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Table from "@/components/Table";
import Textarea from "@/components/Textarea";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { KategoriPaket } from "@/lib/types";

const emptyForm = { kode: "", nama: "", deskripsi: "", tipe: "keduanya", is_active: true };

export default function KategoriUjianPage() {
  const [rows, setRows] = useState<KategoriPaket[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showConfirm, dialog } = useAppDialog();
  const load = async () => { try { setRows((await api.get("/kategori-paket/")).data); } catch (err) { setError(getErrorMessage(err, "Kategori gagal dimuat.")); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const reset = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); setError(""); };
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { if (editingId) await api.put(`/kategori-paket/${editingId}`, form); else await api.post("/kategori-paket/", form); reset(); await load(); } catch (err) { setError(getErrorMessage(err, "Kategori gagal disimpan.")); } };
  const edit = (row: KategoriPaket) => { setForm({ kode: row.kode, nama: row.nama, deskripsi: row.deskripsi ?? "", tipe: row.tipe, is_active: row.is_active }); setEditingId(row.id); setShowForm(true); setError(""); };
  const toggle = async (row: KategoriPaket) => { try { await api.put(`/kategori-paket/${row.id}`, { kode: row.kode, nama: row.nama, deskripsi: row.deskripsi, tipe: row.tipe, is_active: !row.is_active }); await load(); } catch (err) { setError(getErrorMessage(err, "Status kategori gagal diubah.")); } };
  const remove = async (row: KategoriPaket) => { if (!(await showConfirm({ title: "Hapus Kategori", description: "Kategori hanya dapat dihapus jika belum digunakan paket.", confirmLabel: "Hapus", confirmVariant: "danger" }))) return; try { await api.delete(`/kategori-paket/${row.id}`); await load(); } catch (err) { setError(getErrorMessage(err, "Kategori masih digunakan. Nonaktifkan kategori sebagai gantinya.")); } };
  const columns = [
    { header: "Kode", accessor: "kode" as keyof KategoriPaket },
    { header: "Nama", accessor: "nama" as keyof KategoriPaket },
    { header: "Jenis", accessor: (row: KategoriPaket) => row.tipe === "keduanya" ? "Ujian & Latihan" : row.tipe === "ujian" ? "Ujian" : "Latihan" },
    { header: "Status", accessor: (row: KategoriPaket) => row.is_active ? "Aktif" : "Nonaktif" },
    { header: "Deskripsi", accessor: (row: KategoriPaket) => row.deskripsi || "-" },
    { header: "Paket", accessor: (row: KategoriPaket) => row.jumlah_paket ?? 0 },
    { header: "Aksi", accessor: (row: KategoriPaket) => <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(row)}>Edit</Button><Button size="sm" variant="outline" onClick={() => toggle(row)}>{row.is_active ? "Nonaktifkan" : "Aktifkan"}</Button><Button size="sm" variant="danger" disabled={Boolean(row.jumlah_paket)} onClick={() => remove(row)}>Hapus</Button></div> },
  ];
  if (loading) return <div className="py-10 text-center text-text-muted">Memuat data...</div>;
  return <div className="space-y-6"><div className="flex items-start justify-between"><div><h1 className="text-3xl font-bold text-heading-dark">Kategori Ujian</h1><p className="mt-1 text-sm text-text-muted">Kelola kategori paket ujian dan latihan.</p></div>{!showForm && <Button onClick={() => setShowForm(true)}>Tambah Kategori</Button>}</div>{showForm && <Card title={editingId ? "Edit Kategori" : "Tambah Kategori"}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Input label="Kode" required value={form.kode} onChange={(event) => setForm({ ...form, kode: event.target.value.toLowerCase() })} placeholder="contoh_kategori" /><Input label="Nama" required value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} /></div><Select label="Jenis" required value={form.tipe} onChange={(event) => setForm({ ...form, tipe: event.target.value })} options={[{ value: "ujian", label: "Ujian" }, { value: "latihan", label: "Latihan" }, { value: "keduanya", label: "Ujian & Latihan" }]} /><Textarea label="Deskripsi" value={form.deskripsi} onChange={(event) => setForm({ ...form, deskripsi: event.target.value })} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Kategori aktif</label><div className="flex gap-2"><Button type="submit">Simpan</Button><Button type="button" variant="outline" onClick={reset}>Batal</Button></div></form></Card>}{error && <p className="rounded-input bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Card><Table paginate newestFirst data={rows} columns={columns} searchText={(row) => `${row.kode} ${row.nama} ${row.deskripsi ?? ""}`} emptyMessage="Belum ada kategori" /></Card>{dialog}</div>;
}
