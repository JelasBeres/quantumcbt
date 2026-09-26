"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import BagianSetCards from "@/components/BagianSetCards";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { BagianPaket, PaketUjian, Pelajaran, Topik } from "@/lib/types";

// Halaman set soal satu mapel di paket latihan: admin menambah set
// (Matematika 1, Matematika 2, ...), guru pengampu mengisi soal tiap set.
export default function LatihanSetSoal() {
  const isGuru = getUser()?.role === "guru";
  const basePath = isGuru ? "/guru" : "/admin";
  const searchParams = useSearchParams();
  const paketId = Number(searchParams.get("id")) || null;
  const pelajaranId = Number(searchParams.get("pelajaran_id")) || null;
  const { showAlert, dialog } = useAppDialog();
  const [paket, setPaket] = useState<PaketUjian | null>(null);
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [setList, setSetList] = useState<BagianPaket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nama: "", deskripsi: "" });
  const [saving, setSaving] = useState(false);

  const mapelNama = pelajaranList.find((p) => p.id === pelajaranId)?.nama ?? "Mapel";
  const paketHref = paket
    ? `${basePath}/paket-ujian?tipe=latihan&kategori_id=${paket.kategori_id ?? "belum"}&paket_id=${paket.id}`
    : `${basePath}/paket-ujian?tipe=latihan`;

  const load = useCallback(async () => {
    if (!paketId || !pelajaranId) {
      setLoadError("Paket atau mapel tidak valid.");
      setLoading(false);
      return;
    }
    try {
      const [paketRes, bagianRes, pelajaranRes, topikRes] = await Promise.all([
        api.get(`/paket-ujian/${paketId}`),
        api.get(`/paket-ujian/${paketId}/bagian`),
        api.get("/pelajaran/"),
        api.get("/topik/"),
      ]);
      setPaket(paketRes.data);
      setSetList((bagianRes.data as BagianPaket[]).filter((b) => b.pelajaran_id === pelajaranId));
      setPelajaranList(pelajaranRes.data);
      setTopikList(topikRes.data);
      setLoadError("");
    } catch (error) {
      setLoadError(getErrorMessage(error, "Set soal gagal dimuat."));
    } finally {
      setLoading(false);
    }
  }, [paketId, pelajaranId]);

  useEffect(() => {
    load();
  }, [load]);

  const namaSetOtomatis = () => `${mapelNama} ${setList.filter((b) => b.id !== editingId).length + 1}`;

  const openForm = (bagian?: BagianPaket) => {
    setEditingId(bagian?.id ?? null);
    setForm({ nama: bagian?.nama ?? "", deskripsi: bagian?.deskripsi ?? "" });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!paketId || !pelajaranId) return;
    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim() || namaSetOtomatis(),
        urutan: 0,
        pelajaran_id: pelajaranId,
        deskripsi: form.deskripsi || null,
      };
      if (editingId) await api.put(`/paket-ujian/${paketId}/bagian/${editingId}`, payload);
      else await api.post(`/paket-ujian/${paketId}/bagian`, payload);
      setFormOpen(false);
      await load();
    } catch (error) {
      await showAlert({
        title: "Gagal Menyimpan Set Soal",
        description: getErrorMessage(error, "Set soal gagal disimpan."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="flex min-h-[40vh] items-center justify-center text-text-muted">Memuat data...</div>;

  if (loadError || !paket)
    return (
      <Card>
        <p className="text-sm text-red-600">{loadError || "Paket tidak ditemukan."}</p>
        <Link href={paketHref} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Paket
        </Link>
      </Card>
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-heading-dark">Set Soal {mapelNama}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {isGuru
            ? "Isi soal, atur durasi, lalu ajukan review untuk setiap set."
            : "Tambah set soal untuk mapel ini, lalu isi soal dan durasinya sendiri atau serahkan ke guru pengampu. Set yang diisi admin langsung disetujui."}
        </p>
      </header>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Link href={`${basePath}/paket-ujian`} className="rounded px-1 font-semibold text-brand-primary hover:bg-brand-primary/10 hover:underline">Ujian</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={`${basePath}/paket-ujian?tipe=latihan`} className="rounded px-1 font-semibold text-brand-primary hover:bg-brand-primary/10 hover:underline">Latihan</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={`${basePath}/paket-ujian?tipe=latihan&kategori_id=${paket.kategori_id ?? "belum"}`} className="rounded px-1 font-semibold text-brand-primary hover:bg-brand-primary/10 hover:underline">{paket.kategori_nama || paket.kategori || "Belum Berkategori"}</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={paketHref} className="rounded px-1 font-semibold text-brand-primary hover:bg-brand-primary/10 hover:underline">{paket.nama}</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-heading-dark">{mapelNama}</span>
      </nav>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-4">
          <Link href={paketHref} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Mapel
          </Link>
          {!isGuru && !formOpen && (
            <Button size="sm" onClick={() => openForm()}>
              + Tambah Set Soal
            </Button>
          )}
        </div>
        {formOpen && (
          <form
            onSubmit={submit}
            className="mb-5 space-y-3 rounded-input border border-card-border bg-neutral p-4"
          >
            <Input
              label="Nama Set Soal"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder={`Kosongkan untuk "${namaSetOtomatis()}"`}
            />
            <Textarea
              label="Deskripsi (opsional)"
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Set Soal"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setFormOpen(false)}>
                Batal
              </Button>
            </div>
          </form>
        )}
        <BagianSetCards
          paket={paket}
          bagianList={setList}
          pelajaranList={pelajaranList}
          topikList={topikList}
          isGuru={isGuru}
          emptyText={isGuru ? "Admin belum menambahkan set soal untuk mapel ini." : "Belum ada set soal. Klik \"+ Tambah Set Soal\" untuk membuat set pertama."}
          onChanged={load}
          onEdit={openForm}
        />
      </Card>
      {dialog}
    </div>
  );
}
