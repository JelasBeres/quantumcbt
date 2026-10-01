"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import { api, getErrorMessage } from "@/lib/api";
import { KategoriPaket, Kelas, PaketUjian, Program } from "@/lib/types";

type TipePaket = "ujian" | "latihan";
type FormData = {
  nama: string;
  deskripsi: string;
  tipe: TipePaket;
  kategori_id: string;
  kelas_id: string;
  program_id: string;
  metode_penilaian: "biasa" | "kohort";
  skala_kohort: "utbk" | "tka";
  is_random_soal: boolean;
  is_random_opsi: boolean;
  izinkan_pilih_mapel: boolean;
  min_mapel_pilihan: string;
  max_mapel_pilihan: string;
  kkm: string;
};

export default function TambahPaketUjianPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get("id");
  const editId = editIdParam && /^\d+$/.test(editIdParam) ? Number(editIdParam) : null;
  const defaultTipe: TipePaket = searchParams.get("tipe") === "latihan" ? "latihan" : "ujian";
  const [formData, setFormData] = useState<FormData>({
    nama: "",
    deskripsi: "",
    tipe: defaultTipe,
    kategori_id: searchParams.get("kategori_id") ?? "",
    kelas_id: "",
    program_id: "",
    metode_penilaian: "biasa",
    skala_kohort: "utbk",
    is_random_soal: true,
    is_random_opsi: true,
    izinkan_pilih_mapel: true,
    min_mapel_pilihan: "1",
    max_mapel_pilihan: "2",
    kkm: "75",
  });
  const [kategoriList, setKategoriList] = useState<KategoriPaket[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [programList, setProgramList] = useState<Program[]>([]);
  const [legacyPelajaranId, setLegacyPelajaranId] = useState<number | null>(null);
  const [jumlahSoal, setJumlahSoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/kategori-paket/"),
      api.get("/kelas/"),
      api.get("/program/"),
      ...(editId ? [api.get(`/paket-ujian/${editId}`)] : []),
    ])
      .then(([kategoriRes, kelasRes, programRes, paketRes]) => {
        if (!active) return;
        setKategoriList(kategoriRes.data);
        setKelasList(kelasRes.data);
        setProgramList(programRes.data);
        if (paketRes) {
          const item = paketRes.data as PaketUjian;
          setFormData({
            nama: item.nama,
            deskripsi: item.deskripsi || "",
            tipe: item.tipe === "latihan" ? "latihan" : "ujian",
            kategori_id: item.kategori_id ? String(item.kategori_id) : "",
            kelas_id: item.kelas_id ? String(item.kelas_id) : "",
            program_id: item.program_id ? String(item.program_id) : "",
            metode_penilaian: item.metode_penilaian === "kohort" ? "kohort" : "biasa",
            skala_kohort: item.skala_kohort === "tka" ? "tka" : "utbk",
            is_random_soal: item.is_random_soal,
            is_random_opsi: item.is_random_opsi,
            izinkan_pilih_mapel: item.izinkan_pilih_mapel !== false,
            min_mapel_pilihan: String(item.min_mapel_pilihan ?? 1),
            max_mapel_pilihan: String(item.max_mapel_pilihan ?? 2),
            kkm: String(item.kkm ?? 75),
          });
          setLegacyPelajaranId(item.pelajaran_id ?? null);
          setJumlahSoal(item.jumlah_soal);
        }
      })
      .catch((error) => setSaveError(getErrorMessage(error, "Gagal memuat data paket ujian.")))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  const availableCategories = kategoriList.filter(
    (item) => item.is_active && (item.tipe === "keduanya" || item.tipe === formData.tipe),
  );
  const listHref = `/admin/paket-ujian?tipe=${formData.tipe}${formData.kategori_id ? `&kategori=${formData.kategori_id}` : ""}`;
  const selectedCategory = kategoriList.find((item) => String(item.id) === formData.kategori_id);
  const isTka = `${selectedCategory?.kode ?? ""} ${selectedCategory?.nama ?? ""}`.toUpperCase().includes("TKA");

  const handleCategoryChange = (kategoriId: string) => {
    const category = kategoriList.find((item) => String(item.id) === kategoriId);
    const identity = `${category?.kode ?? ""} ${category?.nama ?? ""}`.toUpperCase();
    setFormData((current) => ({
      ...current,
      kategori_id: kategoriId,
      skala_kohort: identity.includes("TKA") ? "tka" : "utbk",
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError("");
    if (!formData.kategori_id) return setSaveError("Kategori wajib dipilih.");
    if (!formData.program_id) return setSaveError("Program wajib diisi. Setiap ujian harus memiliki program.");
    const kkm = Number(formData.kkm);
    if (formData.kkm.trim() === "" || !Number.isFinite(kkm) || kkm < 0 || kkm > 100) return setSaveError("KKM harus angka 0 sampai 100.");
    setSaving(true);
    try {
      const payload = {
        nama: formData.nama,
        deskripsi: formData.deskripsi || null,
        tipe: formData.tipe,
        kategori_id: Number(formData.kategori_id),
        metode_penilaian: formData.tipe === "ujian" ? formData.metode_penilaian : "biasa",
        skala_kohort: formData.skala_kohort,
        is_random_soal: formData.is_random_soal,
        is_random_opsi: formData.is_random_opsi,
        izinkan_pilih_mapel: formData.tipe === "ujian" ? formData.izinkan_pilih_mapel : true,
        min_mapel_pilihan: isTka ? Number(formData.min_mapel_pilihan) : 0,
        max_mapel_pilihan: isTka ? Number(formData.max_mapel_pilihan) : 0,
        kkm,
        jumlah_soal: jumlahSoal,
        pelajaran_id: editId ? legacyPelajaranId : null,
        kelas_id: formData.kelas_id ? Number(formData.kelas_id) : null,
        program_id: Number(formData.program_id),
      };
      if (editId) await api.put(`/paket-ujian/${editId}`, payload);
      else await api.post("/paket-ujian/", payload);
      router.push(listHref);
    } catch (error) {
      setSaveError(getErrorMessage(error, "Gagal menyimpan paket ujian."));
    } finally {
      setSaving(false);
    }
  };

  // KKM hanya untuk Nilai Biasa (0-100); Benchmark Kohort memakai skala sendiri.
  const kkmInput = (
    <Input
      label="KKM (nilai minimal lulus)"
      type="number"
      min={0}
      max={100}
      step="any"
      required
      value={formData.kkm}
      onChange={(event) => setFormData({ ...formData, kkm: event.target.value })}
    />
  );

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-text-muted">Memuat data...</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-heading-dark">{editId ? "Edit Paket" : formData.tipe === "latihan" ? "Buat Latihan" : "Buat Paket"}</h1>
        <p className="mt-1 text-sm text-text-muted">Simpan paket, lalu tambahkan mata pelajaran/bagian dan isi soalnya.</p>
      </header>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nama Paket" required value={formData.nama} onChange={(event) => setFormData({ ...formData, nama: event.target.value })} />
          <Textarea label="Deskripsi" value={formData.deskripsi} onChange={(event) => setFormData({ ...formData, deskripsi: event.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Kategori" required value={formData.kategori_id} onChange={(event) => handleCategoryChange(event.target.value)} options={[{ value: "", label: "- Pilih Kategori -" }, ...availableCategories.map((item) => ({ value: item.id, label: `${item.nama} (${item.kode})` }))]} />
            <Select label="Program" required value={formData.program_id} onChange={(event) => setFormData({ ...formData, program_id: event.target.value })} options={[{ value: "", label: "- Pilih Program -" }, ...programList.map((item) => ({ value: item.id, label: item.nama }))]} />
          </div>
          <Select label="Kelas (opsional)" value={formData.kelas_id} onChange={(event) => setFormData({ ...formData, kelas_id: event.target.value })} options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((item) => ({ value: item.id, label: item.nama }))]} />
          {formData.tipe === "ujian" && (
            <div className="rounded-input border border-card-border bg-neutral p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Bisa Lihat Mapel"
                  value={formData.izinkan_pilih_mapel ? "ya" : "tidak"}
                  onChange={(event) => setFormData({ ...formData, izinkan_pilih_mapel: event.target.value === "ya" })}
                  options={[{ value: "ya", label: "Ya - tampilkan daftar mapel & izinkan latihan per mapel" }, { value: "tidak", label: "Tidak - langsung ke ujian" }]}
                />
              </div>
              <p className="mt-3 text-xs text-text-muted">Jika "Ya", siswa melihat daftar mapel/bagian dulu (tombol "Kerjakan Set Soal") dan dapat menjadikannya latihan setelah try out dikerjakan. Jika "Tidak", tombol paket langsung "Mulai Ujian" tanpa breakdown mapel.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Select
                  label="Metode Penilaian"
                  value={formData.metode_penilaian}
                  onChange={(event) => setFormData({ ...formData, metode_penilaian: event.target.value as "biasa" | "kohort" })}
                  options={[{ value: "biasa", label: "Nilai Biasa" }, { value: "kohort", label: "Benchmark Kohort" }]}
                />
                {formData.metode_penilaian === "biasa" && kkmInput}
                {formData.metode_penilaian === "kohort" && (
                  <Select
                    label="Skala Benchmark"
                    value={formData.skala_kohort}
                    onChange={(event) => setFormData({ ...formData, skala_kohort: event.target.value as "utbk" | "tka" })}
                    options={[{ value: "utbk", label: "UTBK (0–1000)" }, { value: "tka", label: "TKA (200–800)" }]}
                  />
                )}
              </div>
              {isTka && (
                <div className="mt-4 rounded-input border border-brand-primary/20 bg-brand-primary/5 p-4">
                  <p className="text-sm font-bold text-heading-dark">Pilihan Mapel TKA</p>
                  <p className="mt-1 text-xs text-text-muted">Mapel wajib ditentukan pada kartu mapel. Siswa akan memilih mapel pilihan sebelum mulai mengerjakan.</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Input label="Minimal mapel pilihan" type="number" min={1} max={19} required value={formData.min_mapel_pilihan} onChange={(e) => setFormData({ ...formData, min_mapel_pilihan: e.target.value })} />
                    <Input label="Maksimal mapel pilihan" type="number" min={1} max={19} required value={formData.max_mapel_pilihan} onChange={(e) => setFormData({ ...formData, max_mapel_pilihan: e.target.value })} />
                  </div>
                </div>
              )}
              {formData.metode_penilaian === "kohort" && <p className="mt-3 text-xs text-text-muted">Benchmark Kohort membandingkan jawaban dengan peserta terbaru dalam program yang sama. Nilai sementara hingga minimal 5 peserta dan selama koreksi esai belum selesai (esai belum dinilai dihitung 0); belum tersedia jika seluruh soal dijawab benar.</p>}
            </div>
          )}
          {formData.tipe === "latihan" && <div className="grid gap-4 sm:grid-cols-2">{kkmInput}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={formData.is_random_soal} onChange={(event) => setFormData({ ...formData, is_random_soal: event.target.checked })} /> Acak urutan soal</label>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={formData.is_random_opsi} onChange={(event) => setFormData({ ...formData, is_random_opsi: event.target.checked })} /> Acak pilihan jawaban</label>
          </div>
          {saveError && <p className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.push(listHref)}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Paket"}</Button></div>
        </form>
      </Card>
    </div>
  );
}
