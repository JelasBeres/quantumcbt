"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { Pelajaran, Subbab, Topik } from "@/lib/types";

type FormState = { nama: string; is_active: boolean };
const emptyForm: FormState = { nama: "", is_active: true };

export default function BabSubbabPage() {
  const [pelajaran, setPelajaran] = useState<Pelajaran[]>([]);
  const [topik, setTopik] = useState<Topik[]>([]);
  const [subbab, setSubbab] = useState<Subbab[]>([]);
  const [pelajaranId, setPelajaranId] = useState("");
  const [selectedTopikId, setSelectedTopikId] = useState<number | null>(null);
  const [topikForm, setTopikForm] = useState<FormState>(emptyForm);
  const [subbabForm, setSubbabForm] = useState<FormState>(emptyForm);
  const [editingTopikId, setEditingTopikId] = useState<number | null>(null);
  const [editingSubbabId, setEditingSubbabId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showConfirm, dialog } = useAppDialog();

  const load = async () => {
    setError("");
    try {
      const [pelajaranRes, topikRes, subbabRes] = await Promise.all([api.get("/pelajaran/"), api.get("/topik/"), api.get("/subbab/")]);
      setPelajaran(pelajaranRes.data ?? []);
      setTopik(topikRes.data ?? []);
      setSubbab(subbabRes.data ?? []);
      setPelajaranId((current) => current || (pelajaranRes.data?.[0]?.id ? String(pelajaranRes.data[0].id) : ""));
    } catch (err) {
      setError(getErrorMessage(err, "Data bab dan sub bab gagal dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredTopik = useMemo(() => topik.filter((item) => String(item.pelajaran_id) === pelajaranId), [topik, pelajaranId]);
  const selectedTopik = topik.find((item) => item.id === selectedTopikId) ?? null;
  const filteredSubbab = useMemo(() => subbab.filter((item) => item.topik_id === selectedTopikId), [subbab, selectedTopikId]);

  useEffect(() => {
    if (selectedTopikId && !filteredTopik.some((item) => item.id === selectedTopikId)) setSelectedTopikId(null);
  }, [filteredTopik, selectedTopikId]);

  const resetTopik = () => { setTopikForm(emptyForm); setEditingTopikId(null); };
  const resetSubbab = () => { setSubbabForm(emptyForm); setEditingSubbabId(null); };

  const saveTopik = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { pelajaran_id: Number(pelajaranId), nama: topikForm.nama, is_active: topikForm.is_active };
      if (editingTopikId) await api.put(`/topik/${editingTopikId}`, payload);
      else await api.post("/topik/", payload);
      resetTopik();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Bab gagal disimpan."));
    } finally {
      setSaving(false);
    }
  };

  const saveSubbab = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTopikId) return;
    setSaving(true);
    setError("");
    try {
      const payload = { topik_id: selectedTopikId, nama: subbabForm.nama, is_active: subbabForm.is_active };
      if (editingSubbabId) await api.put(`/subbab/${editingSubbabId}`, payload);
      else await api.post("/subbab/", payload);
      resetSubbab();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Sub bab gagal disimpan."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: "topik" | "subbab", id: number) => {
    const confirmed = await showConfirm({
      title: kind === "topik" ? "Hapus Bab" : "Hapus Sub Bab",
      description: "Data yang masih digunakan soal tidak dapat dihapus. Nonaktifkan data jika ingin mempertahankan riwayat.",
      confirmLabel: "Hapus",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    setError("");
    try {
      await api.delete(`/${kind}/${id}`);
      if (kind === "topik" && selectedTopikId === id) setSelectedTopikId(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Data gagal dihapus."));
    }
  };

  const editTopik = (item: Topik) => { setEditingTopikId(item.id); setTopikForm({ nama: item.nama, is_active: item.is_active }); };
  const editSubbab = (item: Subbab) => { setEditingSubbabId(item.id); setSubbabForm({ nama: item.nama, is_active: item.is_active }); };
  const toggleTopik = (item: Topik) => api.put(`/topik/${item.id}`, { pelajaran_id: item.pelajaran_id, nama: item.nama, is_active: !item.is_active }).then(load).catch((err) => setError(getErrorMessage(err, "Status bab gagal diubah.")));
  const toggleSubbab = (item: Subbab) => api.put(`/subbab/${item.id}`, { topik_id: item.topik_id, nama: item.nama, is_active: !item.is_active }).then(load).catch((err) => setError(getErrorMessage(err, "Status sub bab gagal diubah.")));

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-text-muted">Memuat data...</div>;

  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold text-heading-dark">Bab &amp; Sub Bab</h1><p className="mt-1 text-sm text-text-muted">Kelola struktur materi yang digunakan saat membuat soal.</p></header>
    {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card title="Mata Pelajaran">
      <Select label="Pilih mata pelajaran" value={pelajaranId} onChange={(event) => { setPelajaranId(event.target.value); setSelectedTopikId(null); resetTopik(); resetSubbab(); }} options={[{ value: "", label: "- Pilih Mata Pelajaran -" }, ...pelajaran.map((item) => ({ value: item.id, label: item.nama }))]} />
    </Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Bab">
        <form onSubmit={saveTopik} className="mb-5 space-y-3 rounded-card border border-card-border bg-neutral/40 p-4">
          <Input label={editingTopikId ? "Edit nama bab" : "Nama bab baru"} required maxLength={150} disabled={!pelajaranId || saving} value={topikForm.nama} onChange={(event) => setTopikForm({ ...topikForm, nama: event.target.value })} />
          <label className="flex items-center gap-2 text-sm font-medium text-body-dark"><input type="checkbox" checked={topikForm.is_active} onChange={(event) => setTopikForm({ ...topikForm, is_active: event.target.checked })} /> Aktif</label>
          <div className="flex gap-2"><Button type="submit" disabled={!pelajaranId || saving}>{editingTopikId ? "Simpan Bab" : "Tambah Bab"}</Button>{editingTopikId && <Button type="button" variant="outline" onClick={resetTopik}>Batal</Button>}</div>
        </form>
        <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
          {filteredTopik.length === 0 ? <p className="text-sm text-text-muted">Belum ada bab untuk mata pelajaran ini.</p> : filteredTopik.map((item) => <div key={item.id} className={`rounded-card border p-4 ${selectedTopikId === item.id ? "border-brand-primary bg-brand-primary/5" : "border-card-border"}`}>
            <button type="button" onClick={() => { setSelectedTopikId(item.id); resetSubbab(); }} className="w-full text-left"><div className="flex items-center justify-between gap-3"><strong className="text-heading-dark">{item.nama}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.is_active ? "Aktif" : "Nonaktif"}</span></div></button>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => editTopik(item)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void toggleTopik(item)}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</Button><Button size="sm" variant="danger" onClick={() => void remove("topik", item.id)}>Hapus</Button></div>
          </div>)}
        </div>
      </Card>
      <Card title={selectedTopik ? `Sub Bab · ${selectedTopik.nama}` : "Sub Bab"}>
        {!selectedTopik ? <p className="text-sm text-text-muted">Pilih bab untuk melihat dan mengelola sub bab.</p> : <>
          <form onSubmit={saveSubbab} className="mb-5 space-y-3 rounded-card border border-card-border bg-neutral/40 p-4">
            <Input label={editingSubbabId ? "Edit nama sub bab" : "Nama sub bab baru"} required maxLength={150} disabled={saving} value={subbabForm.nama} onChange={(event) => setSubbabForm({ ...subbabForm, nama: event.target.value })} />
            <label className="flex items-center gap-2 text-sm font-medium text-body-dark"><input type="checkbox" checked={subbabForm.is_active} onChange={(event) => setSubbabForm({ ...subbabForm, is_active: event.target.checked })} /> Aktif</label>
            <div className="flex gap-2"><Button type="submit" disabled={saving}>{editingSubbabId ? "Simpan Sub Bab" : "Tambah Sub Bab"}</Button>{editingSubbabId && <Button type="button" variant="outline" onClick={resetSubbab}>Batal</Button>}</div>
          </form>
          <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">{filteredSubbab.length === 0 ? <p className="text-sm text-text-muted">Belum ada sub bab.</p> : filteredSubbab.map((item) => <div key={item.id} className="rounded-card border border-card-border p-4"><div className="flex items-center justify-between gap-3"><strong className="text-heading-dark">{item.nama}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.is_active ? "Aktif" : "Nonaktif"}</span></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => editSubbab(item)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void toggleSubbab(item)}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</Button><Button size="sm" variant="danger" onClick={() => void remove("subbab", item.id)}>Hapus</Button></div></div>)}</div>
        </>}
      </Card>
    </div>
    {dialog}
  </div>;
}
