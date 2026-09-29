"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import Input from "@/components/Input";
import RichEditor from "@/components/RichEditor";
import Select from "@/components/Select";
import { Pelajaran, Kelas, Subbab, Topik } from "@/lib/types";

const OPSI_LABEL = ["A", "B", "C", "D", "E", "F", "G", "H"];

// `id` ikut dikirim balik saat edit agar backend memperbarui opsi/pernyataan in-place
// (jawaban siswa merujuk id tersebut).
type LocalOpsi = { id?: number; teks_opsi: string; is_benar: boolean };
type LocalPernyataan = { id?: number; teks_pernyataan: string; is_benar: boolean };

const opsiKosong = (): LocalOpsi => ({ teks_opsi: "", is_benar: false });
const pernyataanKosong = (): LocalPernyataan => ({ teks_pernyataan: "", is_benar: true });
const opsiBenarSalah = (): LocalOpsi[] => [
  { teks_opsi: "Benar", is_benar: true },
  { teks_opsi: "Salah", is_benar: false }
];
// Default lima pilihan (A-E).
const opsiDefault = (): LocalOpsi[] => Array.from({ length: 5 }, opsiKosong);

const teksPolos = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

const validasiOpsi = (tipe: string, opsi: LocalOpsi[]): string => {
  const valid = opsi.filter((item) => teksPolos(item.teks_opsi));
  const jumlahKunci = valid.filter((item) => item.is_benar).length;
  if (tipe === "pilihan_ganda" && (valid.length < 2 || jumlahKunci !== 1)) {
    return "Pilihan ganda wajib punya minimal dua opsi dan tepat satu kunci jawaban.";
  }
  if (tipe === "pilihan_lebih_dari_satu" && (valid.length < 2 || jumlahKunci < 2)) {
    return "Pilihan lebih dari satu wajib punya minimal dua opsi dan minimal dua kunci jawaban.";
  }
  return "";
};

interface SoalFormModalProps {
  editSoalId?: number | null;
  open: boolean;
  onClose: () => void;
  onCreated: (soalId: number) => void;
  pelajaranList: Pelajaran[];
  kelasList: Kelas[];
  topikList: Topik[];
  defaultPelajaranId?: number | null;
  defaultKelasId?: number | null;
  defaultTopikId?: number | null;
  defaultSubbab?: string | null;
  defaultTipe?: string | null;
  description?: string;
  presentation?: "modal" | "page";
}

export default function SoalFormModal({
  editSoalId,
  open,
  onClose,
  onCreated,
  pelajaranList,
  kelasList,
  topikList,
  defaultPelajaranId,
  defaultKelasId,
  defaultTopikId,
  defaultSubbab,
  defaultTipe,
  description,
  presentation = "modal"
}: SoalFormModalProps) {
  const [formData, setFormData] = useState({
    pelajaran_id: "",
    kelas_id: "",
    topik_id: "",
    subbab_id: "",
    subbab: "",
    teks_soal: "",
    tipe: "pilihan_ganda",
    gambar_url: "",
    tingkat_kesulitan: "sedang",
    poin: "2",
    pembahasan: "",
    kunci_jawaban: "",
    label_benar: "Benar",
    label_salah: "Salah"
  });
  const [opsiList, setOpsiList] = useState<LocalOpsi[]>(opsiDefault());
  const [pernyataanList, setPernyataanList] = useState<LocalPernyataan[]>([pernyataanKosong()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailReady, setDetailReady] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [paketId, setPaketId] = useState<number | null>(null);
  const [subbabList, setSubbabList] = useState<Subbab[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (open) {
      setSavedId(editSoalId ?? null);
      setPaketId(null);
      setDetailReady(!editSoalId);
      setLoadingDetail(!!editSoalId);
      setFormData({
        pelajaran_id: defaultPelajaranId ? String(defaultPelajaranId) : "",
        kelas_id: defaultKelasId ? String(defaultKelasId) : "",
        topik_id: defaultTopikId ? String(defaultTopikId) : "",
         subbab_id: "",
         subbab: defaultSubbab || "",
        teks_soal: "",
        tipe: defaultTipe || "pilihan_ganda",
        gambar_url: "",
    tingkat_kesulitan: "sedang",
    poin: "2",
        pembahasan: "",
        kunci_jawaban: "",
        label_benar: "Benar",
        label_salah: "Salah"
      });
      setOpsiList(defaultTipe === "benar_salah" ? opsiBenarSalah() : opsiDefault());
      setPernyataanList([pernyataanKosong()]);
      setError("");
      if (editSoalId) {
        api.get(`/soal/${editSoalId}`).then(({ data }) => {
          if (cancelled) return;
          setFormData({
            pelajaran_id: data.pelajaran_id ? String(data.pelajaran_id) : "",
            kelas_id: data.kelas_id ? String(data.kelas_id) : "",
             topik_id: data.topik_id ? String(data.topik_id) : "",
             subbab_id: data.subbab_id ? String(data.subbab_id) : "",
             subbab: data.subbab || "", teks_soal: data.teks_soal,
            tipe: data.tipe, gambar_url: data.gambar_url || "",
            tingkat_kesulitan: data.tingkat_kesulitan || "sedang",
            poin: String(data.poin ?? 1),
            pembahasan: data.pembahasan || "", kunci_jawaban: data.kunci_jawaban || "",
            label_benar: data.label_benar || "Benar", label_salah: data.label_salah || "Salah"
          });
          setPaketId(data.paket_ujian_id ?? null);
          setOpsiList(data.opsi_jawaban?.length ? data.opsi_jawaban : opsiDefault());
          setPernyataanList(data.pernyataan?.length ? data.pernyataan : [pernyataanKosong()]);
          setDetailReady(true);
        }).catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, "Detail soal gagal dimuat. Tutup lalu coba lagi."));
        }).finally(() => { if (!cancelled) setLoadingDetail(false); });
      }
    }
    return () => { cancelled = true; };
  }, [open, defaultPelajaranId, defaultKelasId, defaultTopikId, defaultSubbab, defaultTipe, editSoalId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    api.get("/subbab/")
      .then(({ data }) => { if (active) setSubbabList(data ?? []); })
      .catch((err) => { if (active) setError(getErrorMessage(err, "Data sub bab gagal dimuat.")); });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  const updateOpsi = (index: number, patch: Partial<LocalOpsi>) => {
    setOpsiList((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };
  const addOpsi = () => setOpsiList((prev) => (prev.length >= 8 ? prev : [...prev, opsiKosong()]));
  const removeOpsi = (index: number) => setOpsiList((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  const markBenar = (index: number) =>
    setOpsiList((prev) => formData.tipe === "pilihan_lebih_dari_satu"
      ? prev.map((o, i) => (i === index ? { ...o, is_benar: !o.is_benar } : o))
      : prev.map((o, i) => ({ ...o, is_benar: i === index })));

  const handleTipeChange = (tipe: string) => {
    setFormData((prev) => ({ ...prev, tipe }));
    setOpsiList(tipe === "benar_salah" ? opsiBenarSalah() : opsiDefault());
    if (tipe === "benar_salah") setPernyataanList([pernyataanKosong()]);
  };

  const topikUntukPelajaran = topikList.filter((t) => t.pelajaran_id === Number(formData.pelajaran_id) && t.is_active);
  const subbabUntukTopik = subbabList.filter((s) => s.topik_id === Number(formData.topik_id) && s.is_active);

  const handleSubmit = async () => {
    if (saving || !detailReady) return;
    setError("");
    if (!formData.pelajaran_id) {
      setError("Pelajaran wajib dipilih.");
      return;
    }
    if (!teksPolos(formData.teks_soal)) {
      setError("Teks soal wajib diisi.");
      return;
    }
    if (!Number.isFinite(Number(formData.poin)) || Number(formData.poin) <= 0) {
      setError("Poin harus lebih besar dari 0.");
      return;
    }
    if (formData.tipe === "benar_salah") {
      const labelBenar = formData.label_benar.trim();
      const labelSalah = formData.label_salah.trim();
      if (!labelBenar || !labelSalah || labelBenar.toLocaleLowerCase() === labelSalah.toLocaleLowerCase()) {
        setError("Label 1 dan Label 2 wajib diisi dan harus berbeda.");
        return;
      }
      if (!pernyataanList.length || pernyataanList.some((item) => !teksPolos(item.teks_pernyataan))) {
        setError("Minimal satu pernyataan wajib diisi.");
        return;
      }
    }
    const opsiError = validasiOpsi(formData.tipe, opsiList);
    if (opsiError) {
      setError(opsiError);
      return;
    }
    setSaving(true);
    try {
      let soalId: number;
      try {
        const payload = {
          paket_ujian_id: paketId,
          pelajaran_id: formData.pelajaran_id ? Number(formData.pelajaran_id) : null,
          kelas_id: formData.kelas_id ? Number(formData.kelas_id) : null,
           topik_id: formData.topik_id ? Number(formData.topik_id) : null,
           subbab_id: formData.subbab_id ? Number(formData.subbab_id) : null,
           subbab: formData.subbab.trim() || null,
          teks_soal: formData.teks_soal,
           tipe: formData.tipe,
           gambar_url: formData.gambar_url || null,
            tingkat_kesulitan: formData.tingkat_kesulitan,
            poin: Number(formData.poin),
           pembahasan: formData.pembahasan.trim() || null,
          kunci_jawaban: formData.kunci_jawaban.trim() || null,
          label_benar: formData.label_benar.trim() || null,
          label_salah: formData.label_salah.trim() || null
        };
        const res = savedId ? await api.put(`/soal/${savedId}`, payload) : await api.post("/soal/", payload);
        soalId = savedId ?? res.data.id;
        setSavedId(soalId);
      } catch (err) {
        setError(getErrorMessage(err, "Gagal membuat soal."));
        return;
      }
      if (formData.tipe === "benar_salah") {
        await api.put(`/soal/${soalId}/pernyataan-benar-salah`, {
          label_benar: formData.label_benar,
          label_salah: formData.label_salah,
          pernyataan: pernyataanList
        });
      } else if (formData.tipe === "pilihan_ganda" || formData.tipe === "pilihan_lebih_dari_satu") {
        await api.put(`/soal/${soalId}/opsi`, { opsi: opsiList });
      }
      onCreated(soalId);
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menyimpan opsi."));
    } finally {
      setSaving(false);
    }
  };

  const pageMode = presentation === "page";

  return (
    <div
      className={pageMode ? "w-full" : "fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4"}
      role={pageMode ? undefined : "dialog"}
      aria-modal={pageMode ? undefined : true}
      aria-labelledby="soal-form-title"
    >
      <div className={pageMode ? "w-full rounded-card border border-card-border bg-card-bg shadow-card" : "my-6 w-full max-w-3xl rounded-modal border border-card-border bg-card-bg shadow-modal"}>
        <div className="flex items-start justify-between gap-4 border-b border-card-border px-4 py-4 sm:px-6">
          <div>
            <h2 id="soal-form-title" className="text-lg font-bold text-heading-dark">{editSoalId ? "Edit Soal" : "Buat Soal Baru"}</h2>
            {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
            <Button type="button" variant="blue" disabled={saving || loadingDetail || !detailReady} onClick={handleSubmit}>
              {saving ? "Menyimpan..." : "Simpan Soal"}
            </Button>
          </div>
          {!pageMode && <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-text-muted transition hover:bg-neutral hover:text-heading-dark" aria-label="Tutup">×</button>}
        </div>

        <fieldset disabled={saving || loadingDetail || !detailReady} className="space-y-4 p-4 sm:p-6">
          {loadingDetail && <p role="status">Memuat detail soal...</p>}
          {error && <div role="alert" className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {/* Klasifikasi soal dalam satu baris (layar lebar): Kelas, Mapel, Bab, Sub Bab, Tipe, Kesulitan, Poin. */}
          <div className={`grid gap-3 sm:grid-cols-2 md:grid-cols-4 ${pageMode ? "xl:grid-cols-7" : ""}`}>
            <Select
              label="Kelas"
              value={formData.kelas_id}
              onChange={(e) => setFormData({ ...formData, kelas_id: e.target.value })}
              options={[
                { value: "", label: "- Pilih Kelas -" },
                ...kelasList.map((k) => ({ value: k.id, label: k.nama }))
              ]}
            />
            <Select
              label="Mapel"
              required
              value={formData.pelajaran_id}
               onChange={(e) => setFormData({ ...formData, pelajaran_id: e.target.value, topik_id: "", subbab_id: "", subbab: "" })}
              options={[
                { value: "", label: "- Pilih Mapel -" },
                ...pelajaranList.map((p) => ({ value: p.id, label: p.nama }))
              ]}
            />
            <Select
              label="Bab"
              value={formData.topik_id}
               onChange={(e) => setFormData({ ...formData, topik_id: e.target.value, subbab_id: "", subbab: "" })}
              options={[
                { value: "", label: "- Pilih Bab -" },
                ...topikUntukPelajaran.map((t) => ({ value: t.id, label: t.nama }))
              ]}
            />
          <Select
            label="Sub Bab"
            disabled={!formData.topik_id}
            value={formData.subbab_id || (formData.subbab ? "legacy" : "")}
            onChange={(e) => {
              const selected = subbabUntukTopik.find((item) => String(item.id) === e.target.value);
              setFormData({ ...formData, subbab_id: selected ? String(selected.id) : "", subbab: selected?.nama || (e.target.value === "legacy" ? formData.subbab : "") });
            }}
            options={[
              { value: "", label: "- Pilih Sub Bab -" },
              ...(formData.subbab && !formData.subbab_id ? [{ value: "legacy", label: `${formData.subbab} (data lama)` }] : []),
              ...(formData.subbab_id && !subbabUntukTopik.some((item) => String(item.id) === formData.subbab_id) ? [{ value: formData.subbab_id, label: `${formData.subbab} (nonaktif)` }] : []),
              ...subbabUntukTopik.map((item) => ({ value: item.id, label: item.nama }))
            ]}
          />
            <Select
              label="Tipe Soal"
              required
              value={formData.tipe}
              onChange={(e) => handleTipeChange(e.target.value)}
              options={[
                { value: "pilihan_ganda", label: "Pilihan Ganda" },
                { value: "pilihan_lebih_dari_satu", label: "Pilihan Lebih dari Satu" },
                { value: "benar_salah", label: "Benar / Salah" },
                { value: "esai", label: "Esai" },
                { value: "isian", label: "Isian" }
              ]}
            />
               <Select
                label="Kesulitan"
                value={formData.tingkat_kesulitan}
                onChange={(e) => setFormData({ ...formData, tingkat_kesulitan: e.target.value })}
                options={[
                  { value: "mudah", label: "Mudah" },
                  { value: "sedang", label: "Sedang" },
                  { value: "sulit", label: "Sulit" }
                ]}
               />
               <Input
                 label="Poin"
                 type="number"
                 min="0.01"
                 step="0.01"
                 required
                 value={formData.poin}
                 onChange={(e) => setFormData({ ...formData, poin: e.target.value })}
               />
          </div>

            <RichEditor
              label="Teks Soal"
              required
              value={formData.teks_soal}
              onChange={(html) => setFormData({ ...formData, teks_soal: html })}
              placeholder="Tulis soal di sini. Gunakan tombol Σ untuk menyisipkan rumus matematika."
            />

            {formData.tipe === "isian" && (
              <Input
                label="Kunci Jawaban Isian"
                value={formData.kunci_jawaban}
                onChange={(e) => setFormData({ ...formData, kunci_jawaban: e.target.value })}
                placeholder="Contoh: Jakarta | Batavia (pisahkan alternatif dengan |)"
              />
            )}

            {formData.tipe === "esai" && (
              <RichEditor
                label="Jawaban Esai / Pedoman Penilaian"
                value={formData.kunci_jawaban}
                onChange={(html) => setFormData({ ...formData, kunci_jawaban: html })}
                placeholder="Tulis jawaban yang diharapkan atau pedoman penilaian esai."
                minHeight="96px"
              />
            )}

          {formData.tipe === "benar_salah" && (
            <div className="rounded-card border border-card-border bg-neutral p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Label 1" required value={formData.label_benar} onChange={(e) => setFormData({ ...formData, label_benar: e.target.value })} />
                <Input label="Label 2" required value={formData.label_salah} onChange={(e) => setFormData({ ...formData, label_salah: e.target.value })} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-semibold text-heading-dark">Pernyataan &amp; Kunci</h3>
                <Button size="sm" variant="outline" type="button" onClick={() => setPernyataanList((prev) => [...prev, pernyataanKosong()])}>+ Tambah Pernyataan</Button>
              </div>
              <div className="mt-3 space-y-3">
                {pernyataanList.map((item, idx) => (
                  <div key={idx} className="rounded-input border border-card-border bg-card-bg p-3">
                    <RichEditor value={item.teks_pernyataan} onChange={(html) => setPernyataanList((prev) => prev.map((row, i) => i === idx ? { ...row, teks_pernyataan: html } : row))} placeholder={`Pernyataan ${idx + 1}`} minHeight="72px" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-2">
                        {[true, false].map((value) => (
                          <button key={String(value)} type="button" onClick={() => setPernyataanList((prev) => prev.map((row, i) => i === idx ? { ...row, is_benar: value } : row))} className={`rounded-btn border px-3 py-1.5 text-sm font-semibold ${item.is_benar === value ? "border-brand-primary bg-brand-primary text-white" : "border-card-border bg-card-bg text-body-dark"}`}>{value ? formData.label_benar || "Label 1" : formData.label_salah || "Label 2"}</button>
                        ))}
                      </div>
                      {pernyataanList.length > 1 && <button type="button" onClick={() => setPernyataanList((prev) => prev.filter((_, i) => i !== idx))} className="rounded-btn px-2 py-1 text-sm text-cta">Hapus</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(formData.tipe === "pilihan_ganda" || formData.tipe === "pilihan_lebih_dari_satu") && (
            <div className="rounded-card border border-card-border bg-neutral p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-heading-dark">Pilihan Jawaban &amp; Kunci</h3>
                <Button size="sm" variant="outline" type="button" onClick={addOpsi}>+ Tambah Opsi</Button>
              </div>
              <p className="mb-4 text-xs text-text-muted">
                {formData.tipe === "pilihan_lebih_dari_satu"
                  ? "Klik lingkaran untuk menandai semua pilihan yang benar (boleh lebih dari satu)."
                  : "Isi pilihan lalu klik lingkaran untuk menandai jawaban benar."}
              </p>
              <div className="space-y-2">
                {opsiList.map((opsi, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => markBenar(idx)}
                      title={opsi.is_benar ? "Kunci jawaban" : "Jadikan kunci jawaban"}
                      className={`mt-2 flex h-7 w-7 shrink-0 items-center justify-center text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                        formData.tipe === "pilihan_lebih_dari_satu" ? "rounded-input" : "rounded-full"
                      } ${
                        opsi.is_benar ? "bg-brand-primary text-heading-light" : "border border-card-border bg-card-bg text-body-dark"
                      }`}
                    >
                      {OPSI_LABEL[idx] || idx + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      {formData.tipe === "benar_salah" ? (
                        <div className="rounded-input border border-card-border bg-card-bg px-3 py-2.5 text-sm font-semibold text-body-dark">
                          {opsi.teks_opsi}
                        </div>
                      ) : (
                        <RichEditor
                          value={opsi.teks_opsi}
                          onChange={(html) => updateOpsi(idx, { teks_opsi: html })}
                          placeholder={`Teks pilihan ${OPSI_LABEL[idx] || idx + 1}`}
                          minHeight="72px"
                        />
                      )}
                    </div>
                    {formData.tipe !== "benar_salah" && opsiList.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOpsi(idx)}
                        className="mt-2 rounded-lg px-2 py-1 text-text-muted transition hover:text-cta"
                        title="Hapus opsi"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <RichEditor
            label="Pembahasan (opsional)"
            value={formData.pembahasan}
            onChange={(html) => setFormData({ ...formData, pembahasan: html })}
            placeholder="Tulis pembahasan soal di sini."
            minHeight="96px"
          />

          {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-card-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="button" variant="blue" disabled={saving} onClick={handleSubmit}>
              {saving ? "Menyimpan..." : "Simpan Soal"}
            </Button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
