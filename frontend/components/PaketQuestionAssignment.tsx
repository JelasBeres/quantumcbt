"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import QuestionMetaFilters, { emptyMetaFilter, matchesMeta } from "@/components/QuestionMetaFilters";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import MathContent from "@/components/MathContent";
import Select from "@/components/Select";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { BagianPaket, Kelas, PaketUjian, Pelajaran, Program, Soal, Subbab, Topik } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

type PickerMode = "manual" | "auto";
type Kesulitan = "mudah" | "sedang" | "sulit";
type GuruScope = {
  pelajaran_id: number;
  program_id?: number | null;
  kelas_id?: number | null;
};
type GenerateResponse = {
  requested: number;
  available: number;
  selected: number;
  shortage: number;
  items: Soal[];
};

const emptyPickerFilter = { q: "", topik_id: "", subbab: "", kesulitan: "" };
const tipeList = [
  { value: "pilihan_ganda", label: "Pilihan Ganda" },
  { value: "pilihan_lebih_dari_satu", label: "Pilihan >1" },
  { value: "benar_salah", label: "Benar / Salah" },
  { value: "esai", label: "Esai" },
  { value: "isian", label: "Isian" }
];

function positiveId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function scopeMatches(
  scope: GuruScope,
  pelajaranId: number,
  programId: number | null,
  kelasId: number | null
) {
  return scope.pelajaran_id === pelajaranId &&
    (scope.program_id == null || programId == null || scope.program_id === programId) &&
    (scope.kelas_id == null || kelasId == null || scope.kelas_id === kelasId);
}

function questionIsEligible(
  soal: Soal,
  paket: PaketUjian,
  bagian: BagianPaket,
  scopes: GuruScope[],
  pelajaranProgramId: number | null
) {
  if (bagian.pelajaran_id == null || soal.pelajaran_id !== bagian.pelajaran_id || soal.status !== "approved") return false;
  if (paket.kelas_id != null && soal.kelas_id !== paket.kelas_id) return false;
  const programId = paket.program_id ?? pelajaranProgramId;
  const kelasId = paket.kelas_id ?? soal.kelas_id ?? null;
  return scopes.some((scope) => scopeMatches(scope, bagian.pelajaran_id as number, programId ?? null, kelasId));
}

export default function PaketQuestionAssignment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paketId = positiveId(searchParams.get("id"));
  const bagianId = positiveId(searchParams.get("bagian_id"));
  const [paket, setPaket] = useState<PaketUjian | null>(null);
  const [bagian, setBagian] = useState<BagianPaket | null>(null);
  const [scopes, setScopes] = useState<GuruScope[]>([]);
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [programList, setProgramList] = useState<Program[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [subbabList, setSubbabList] = useState<Subbab[]>([]);
  const [bankSoal, setBankSoal] = useState<Soal[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pickerFilter, setPickerFilter] = useState(emptyPickerFilter);
  const [metaFilter, setMetaFilter] = useState(emptyMetaFilter);
  const [activeTipe, setActiveTipe] = useState("pilihan_ganda");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eligibilityNotice, setEligibilityNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pickerMode, setPickerMode] = useState<PickerMode>("manual");
  const [autoForm, setAutoForm] = useState({ pelajaran_id: "", kelas_id: "", topik_id: "", subbab: "", tipe: "pilihan_ganda", kesulitan: "mudah" as Kesulitan | "campuran", jumlah: "5", mudah: "5", sedang: "3", sulit: "2" });
  const [autoCandidates, setAutoCandidates] = useState<Soal[]>([]);
  const [autoResult, setAutoResult] = useState<GenerateResponse | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (getUser()?.role !== "guru") {
        setLoadError("Halaman pengisian soal bagian hanya tersedia untuk guru.");
        setLoading(false);
        return;
      }
      if (!paketId || !bagianId) {
        setLoadError("ID paket atau bagian tidak valid.");
        setLoading(false);
        return;
      }
      try {
        const [paketRes, bagianRes, scopeRes, pelajaranRes, kelasRes, programRes, topikRes, subbabRes] = await Promise.all([
          api.get(`/paket-ujian/${paketId}`),
          api.get(`/paket-ujian/${paketId}/bagian/${bagianId}`),
          api.get("/guru-scope/me"),
          api.get("/pelajaran/"),
          api.get("/kelas/"),
          api.get("/program/"),
          api.get("/topik/"),
          api.get("/subbab/")
        ]);
        if (!active) return;
        const nextPaket = paketRes.data as PaketUjian;
        const nextBagian = bagianRes.data as BagianPaket;
        const nextScopes = scopeRes.data as GuruScope[];
        const nextPelajaranList = pelajaranRes.data as Pelajaran[];
        const sectionSubject = nextPelajaranList.find((item) => item.id === nextBagian.pelajaran_id);
        if (nextBagian.paket_ujian_id !== nextPaket.id || !nextBagian.pelajaran_id || !sectionSubject) {
          throw new Error("INVALID_SECTION");
        }
        const effectiveProgramId = nextPaket.program_id ?? sectionSubject.program_id ?? null;
        if (!nextScopes.some((scope) => scopeMatches(scope, nextBagian.pelajaran_id as number, effectiveProgramId, nextPaket.kelas_id ?? null))) {
          throw new Error("OUT_OF_SCOPE");
        }
        const bankRes = await api.get("/soal/", {
          params: {
            pelajaran_id: nextBagian.pelajaran_id,
            kelas_id: nextPaket.kelas_id ?? undefined,
            status_filter: "approved"
          }
        });
        if (!active) return;
        const eligibleQuestions = (bankRes.data as Soal[]).filter((soal) => questionIsEligible(soal, nextPaket, nextBagian, nextScopes, sectionSubject.program_id ?? null));
        const eligibleIds = new Set(eligibleQuestions.map((soal) => soal.id));
        const assignedIds = (nextBagian.soal_ids ?? []).filter((id) => eligibleIds.has(id));
        const unavailableCount = (nextBagian.soal_ids ?? []).length - assignedIds.length;
        setPaket(nextPaket);
        setBagian(nextBagian);
        setScopes(nextScopes);
        setSelectedIds(assignedIds);
        setBankSoal(eligibleQuestions);
        setPelajaranList(nextPelajaranList);
        setKelasList(kelasRes.data ?? []);
        setProgramList(programRes.data ?? []);
        setTopikList((topikRes.data as Topik[]).filter((item) => item.pelajaran_id === nextBagian.pelajaran_id));
        setSubbabList((subbabRes.data as Subbab[]).filter((item) => item.pelajaran_id == null || item.pelajaran_id === nextBagian.pelajaran_id));
        setAutoForm((current) => ({
          ...current,
          pelajaran_id: String(nextBagian.pelajaran_id),
          kelas_id: nextPaket.kelas_id ? String(nextPaket.kelas_id) : ""
        }));
        if (unavailableCount > 0) {
          setEligibilityNotice(`${unavailableCount} soal lama tidak dimuat karena tidak lagi approved atau tidak sesuai mapel, kelas, dan scope bagian.`);
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof Error && error.message === "INVALID_SECTION") {
          setLoadError("Bagian paket tidak valid atau belum memiliki mata pelajaran.");
        } else if (error instanceof Error && error.message === "OUT_OF_SCOPE") {
          setLoadError("Bagian ini berada di luar penugasan mata pelajaran, program, atau kelas Anda.");
        } else {
          setLoadError(getErrorMessage(error, "Gagal memuat data pengisian soal bagian."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [bagianId, paketId]);

  const listHref = useMemo(() => {
    if (!paket) return "/guru/paket-ujian";
    const tipe = paket.tipe === "latihan" ? "latihan" : "ujian";
    const kategoriId = paket.kategori_id == null ? "belum" : String(paket.kategori_id);
    return `/guru/paket-ujian?tipe=${tipe}&kategori_id=${encodeURIComponent(kategoriId)}`;
  }, [paket]);

  const getNama = <T extends { id: number; nama: string }>(list: T[], id: number | null | undefined) => {
    if (!id) return "-";
    return list.find((item) => item.id === id)?.nama ?? "-";
  };

  const selectedPelajaran = pelajaranList.find((item) => item.id === bagian?.pelajaran_id);
  const selectedKelas = paket?.kelas_id ? getNama(kelasList, paket.kelas_id) : "Semua kelas";
  const selectedProgram = paket?.program_id ? getNama(programList, paket.program_id) : selectedPelajaran?.program_id ? getNama(programList, selectedPelajaran.program_id) : "Semua program";

  const tipeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bankSoal.forEach((soal) => {
      counts[soal.tipe] = (counts[soal.tipe] || 0) + 1;
    });
    return counts;
  }, [bankSoal]);

  const masterAndLegacySubbab = (topikId: string) => {
    const master = subbabList
      .filter((item) => item.is_active && (!topikId || String(item.topik_id) === topikId))
      .map((item) => item.nama);
    const legacy = bankSoal
      .filter((soal) => !topikId || String(soal.topik_id) === topikId)
      .map((soal) => soal.subbab)
      .filter((value): value is string => !!value);
    return Array.from(new Set([...master, ...legacy])).sort((a, b) => a.localeCompare(b, "id"));
  };

  const filteredSoal = useMemo(() => {
    const query = pickerFilter.q.trim().toLowerCase();
    return bankSoal.filter((soal) => matchesMeta(soal, metaFilter) && soal.tipe === activeTipe &&
      (!pickerFilter.topik_id || String(soal.topik_id) === pickerFilter.topik_id) &&
      (!pickerFilter.subbab || soal.subbab === pickerFilter.subbab) &&
      (!pickerFilter.kesulitan || soal.tingkat_kesulitan === pickerFilter.kesulitan) &&
      (!query || [soal.teks_soal.replace(/<[^>]*>/g, " "), String(soal.id), soal.subbab ?? ""].some((value) => value.toLowerCase().includes(query))));
  }, [activeTipe, bankSoal, metaFilter, pickerFilter]);

  const toggleSelect = (soalId: number) => {
    setSelectedIds((current) => current.includes(soalId) ? current.filter((id) => id !== soalId) : [...current, soalId]);
  };

  const updateAutoForm = (patch: Partial<typeof autoForm>) => {
    setAutoForm((current) => {
      const next = { ...current, ...patch };
      if (patch.topik_id !== undefined) next.subbab = "";
      return next;
    });
    setAutoError("");
    setAutoResult(null);
    setAutoCandidates([]);
  };

  const generateKandidat = async () => {
    if (!paket || !bagian?.pelajaran_id || !selectedPelajaran) return;
    const requests = autoForm.kesulitan === "campuran"
      ? (["mudah", "sedang", "sulit"] as Kesulitan[]).map((kesulitan) => ({ kesulitan, jumlah: Number(autoForm[kesulitan]) }))
      : [{ kesulitan: autoForm.kesulitan, jumlah: Number(autoForm.jumlah) }];
    const total = requests.reduce((sum, item) => sum + item.jumlah, 0);
    if (requests.some((item) => !Number.isInteger(item.jumlah) || item.jumlah < 0) || total < 1 || total > 100) {
      setAutoError("Isi jumlah bulat minimal 0 per tingkat. Total soal harus antara 1 sampai 100.");
      return;
    }
    setAutoLoading(true);
    setAutoError("");
    try {
      const responses = await Promise.all(requests.filter((item) => item.jumlah > 0).map(async ({ kesulitan, jumlah }) => {
        const response = await api.post<GenerateResponse>("/soal/generate-kandidat", {
          pelajaran_id: bagian.pelajaran_id,
          kelas_id: paket.kelas_id ?? null,
          topik_id: autoForm.topik_id ? Number(autoForm.topik_id) : null,
          subbab: autoForm.subbab || null,
          tipe: autoForm.tipe,
          kesulitan,
          jumlah,
          exclude_ids: selectedIds
        });
        const items = (response.data.items ?? []).filter((soal) =>
          questionIsEligible(soal, paket, bagian, scopes, selectedPelajaran.program_id ?? null) &&
          soal.tipe === autoForm.tipe &&
          soal.tingkat_kesulitan === kesulitan &&
          (!autoForm.topik_id || soal.topik_id === Number(autoForm.topik_id)) &&
          (!autoForm.subbab || soal.subbab === autoForm.subbab)
        );
        return { ...response.data, requested: jumlah, items, selected: items.length, shortage: Math.max(0, jumlah - items.length), kesulitan };
      }));
      const generated = Array.from(new Map(responses.flatMap((response) => response.items).map((soal) => [soal.id, soal])).values());
      setAutoCandidates(generated);
      setBankSoal((current) => Array.from(new Map([...current, ...generated].map((soal) => [soal.id, soal])).values()));
      setSelectedIds((current) => Array.from(new Set([...current, ...generated.map((soal) => soal.id)])));
      const shortage = Math.max(0, total - generated.length);
      setAutoResult({ requested: total, available: responses.reduce((sum, response) => sum + response.available, 0), selected: generated.length, shortage, items: generated });
      const shortages = responses.filter((response) => response.shortage > 0);
      if (shortages.length) {
        setAutoError(shortages.map((response) => `${response.kesulitan}: diminta ${response.requested}, kandidat valid ${response.selected}, kurang ${response.shortage}`).join(". "));
      }
    } catch (error) {
      setAutoError(getErrorMessage(error, "Kandidat soal gagal dibuat."));
    } finally {
      setAutoLoading(false);
    }
  };

  const saveSelection = async () => {
    if (!paket || !bagian) return;
    const eligibleIds = new Set(bankSoal.map((soal) => soal.id));
    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.some((id) => !eligibleIds.has(id))) {
      setSaveError("Pilihan memuat soal yang tidak lagi sesuai mapel, kelas, status approved, atau scope bagian. Muat ulang halaman lalu pilih kembali.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await api.put(`/paket-ujian/${paket.id}/bagian/${bagian.id}/soal`, { soal_ids: uniqueIds });
      router.push(listHref);
    } catch (error) {
      setSaveError(getErrorMessage(error, "Gagal menyimpan pilihan soal bagian."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-text-muted">Memuat data...</div>;

  if (!paket || !bagian || loadError) {
    return (
      <div className="space-y-4">
        <Link href="/guru/paket-ujian" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Paket</Link>
        <Card><p className="text-red-700">{loadError || "Paket atau bagian ujian tidak ditemukan."}</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href={listHref} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Paket</Link>
        <h1 className="text-3xl font-bold text-heading-dark">Isi Soal Bagian</h1>
        <p className="mt-1 text-sm text-text-muted">Pilih soal approved dari Bank Soal sesuai penugasan bagian.</p>
      </header>

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div><dt className="text-text-muted">Paket</dt><dd className="mt-1 font-semibold text-heading-dark">{paket.nama}</dd></div>
          <div><dt className="text-text-muted">Bagian</dt><dd className="mt-1 font-semibold text-heading-dark">{bagian.nama}</dd></div>
          <div><dt className="text-text-muted">Mata Pelajaran</dt><dd className="mt-1 font-semibold text-heading-dark">{selectedPelajaran?.nama ?? "-"}</dd></div>
          <div><dt className="text-text-muted">Program / Kelas</dt><dd className="mt-1 font-semibold text-heading-dark">{selectedProgram} / {selectedKelas}</dd></div>
          <div><dt className="text-text-muted">Durasi Bagian</dt><dd className="mt-1 font-semibold text-heading-dark">{bagian.durasi_menit ? `${bagian.durasi_menit} menit` : "Belum diatur"}</dd></div>
        </dl>
      </Card>

      <Card>
        <div className="mb-5 inline-flex rounded-input border border-card-border bg-neutral p-1" aria-label="Mode pemilihan soal">
          {([{"value":"manual","label":"Pilih Manual"},{"value":"auto","label":"Auto-Generate"}] as const).map((mode) => (
            <button key={mode.value} type="button" onClick={() => setPickerMode(mode.value)} aria-pressed={pickerMode === mode.value} className={`min-h-11 rounded-btn border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${pickerMode === mode.value ? "border-brand-primary bg-card-bg text-brand-primary shadow-card" : "border-transparent text-text-muted hover:bg-card-bg hover:text-body-dark"}`}>{mode.label}</button>
          ))}
        </div>

        {eligibilityNotice && <p className="mb-4 rounded-input border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{eligibilityNotice}</p>}

        {pickerMode === "manual" ? (
          <>
            <QuestionMetaFilters items={bankSoal} value={metaFilter} onChange={setMetaFilter} />
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Cari isi soal / ID" value={pickerFilter.q} onChange={(event) => setPickerFilter({ ...pickerFilter, q: event.target.value })} />
              <Select label="Bab" value={pickerFilter.topik_id} onChange={(event) => setPickerFilter({ ...pickerFilter, topik_id: event.target.value, subbab: "" })} options={[{ value: "", label: "Semua bab" }, ...topikList.filter((topik) => topik.is_active).map((topik) => ({ value: topik.id, label: topik.nama }))]} />
              <Select label="Subbab" value={pickerFilter.subbab} onChange={(event) => setPickerFilter({ ...pickerFilter, subbab: event.target.value })} options={[{ value: "", label: "Semua subbab" }, ...masterAndLegacySubbab(pickerFilter.topik_id).map((subbab) => ({ value: subbab, label: subbab }))]} />
              <Select label="Kesulitan" value={pickerFilter.kesulitan} onChange={(event) => setPickerFilter({ ...pickerFilter, kesulitan: event.target.value })} options={[{ value: "", label: "Semua tingkat" }, ...["mudah", "sedang", "sulit"].map((value) => ({ value, label: value }))]} />
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input value={pickerFilter.q} onChange={(event) => setPickerFilter({ ...pickerFilter, q: event.target.value })} placeholder="Cari isi soal / ID..." className="w-full rounded-input border border-card-border bg-card-bg py-2 pl-9 pr-3 text-sm text-body-dark placeholder:text-text-muted outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25" />
              </div>
              <Button variant="outline" onClick={() => { setPickerFilter(emptyPickerFilter); setMetaFilter(emptyMetaFilter); }}>Reset filter</Button>
            </div>
            <div className="mb-5 flex flex-wrap gap-2 border-b border-card-border pb-3">
              {tipeList.map((tipe) => {
                const active = activeTipe === tipe.value;
                return <button key={tipe.value} type="button" onClick={() => setActiveTipe(tipe.value)} className={`flex items-center gap-1.5 rounded-btn border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-brand-primary bg-card-bg text-brand-primary shadow-sm" : "border-transparent bg-neutral text-text-muted hover:bg-card-bg hover:text-body-dark"}`}><span>{tipe.label}</span><span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-brand-primary/15 font-bold text-brand-primary" : "bg-card-border text-text-muted"}`}>{tipeCounts[tipe.value] || 0}</span></button>;
              })}
            </div>
            {filteredSoal.length === 0 ? <p className="py-8 text-center text-sm text-text-muted">Tidak ada soal approved yang sesuai dengan bagian dan filter.</p> : <div className="max-h-[32rem] space-y-2 overflow-y-auto">{filteredSoal.map((soal) => <label key={soal.id} className="flex cursor-pointer items-start gap-3 rounded-input border border-card-border bg-card-bg p-3 transition hover:border-brand-primary/50 hover:bg-brand-primary/[0.02] focus-within:ring-2 focus-within:ring-brand-primary/25"><input type="checkbox" checked={selectedIds.includes(soal.id)} onChange={() => toggleSelect(soal.id)} className="mt-1 h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary" /><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap gap-2 text-xs text-text-muted"><span>#{soal.id}</span><span>{labelTipeSoal(soal.tipe)}</span><span>{getNama(topikList, soal.topik_id)}</span>{soal.subbab && <span>{soal.subbab}</span>}<span>Kesulitan {soal.tingkat_kesulitan ?? "-"}</span></div><MathContent className="prose prose-sm max-w-none" html={soal.teks_soal} /></div></label>)}</div>}
          </>
        ) : (
          <>
            <div className="rounded-input border border-card-border bg-neutral p-4">
              <div className="mb-4"><h3 className="text-sm font-bold text-heading-dark">Generate Kandidat Soal</h3><p className="mt-0.5 text-xs text-text-muted">Mata pelajaran dan kelas dikunci mengikuti bagian. Kandidat valid digabungkan dengan pilihan manual tanpa duplikat.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Mata Pelajaran" disabled value={autoForm.pelajaran_id} options={[{ value: autoForm.pelajaran_id, label: selectedPelajaran?.nama ?? "-" }]} />
                <Select label="Kelas Paket" disabled value={autoForm.kelas_id} options={[{ value: autoForm.kelas_id, label: selectedKelas }]} />
                <Select label="Bab" value={autoForm.topik_id} onChange={(event) => updateAutoForm({ topik_id: event.target.value })} options={[{ value: "", label: "Semua bab" }, ...topikList.filter((topik) => topik.is_active).map((topik) => ({ value: topik.id, label: topik.nama }))]} />
                <Select label="Subbab" value={autoForm.subbab} onChange={(event) => updateAutoForm({ subbab: event.target.value })} options={[{ value: "", label: "Semua subbab" }, ...masterAndLegacySubbab(autoForm.topik_id).map((subbab) => ({ value: subbab, label: subbab }))]} />
                <Select label="Tipe Soal" required value={autoForm.tipe} onChange={(event) => updateAutoForm({ tipe: event.target.value })} options={tipeList.map((tipe) => ({ value: tipe.value, label: tipe.label }))} />
                <Select label="Tingkat Kesulitan" required value={autoForm.kesulitan} onChange={(event) => updateAutoForm({ kesulitan: event.target.value as Kesulitan | "campuran" })} options={[{ value: "mudah", label: "Mudah" }, { value: "sedang", label: "Sedang" }, { value: "sulit", label: "Sulit" }, { value: "campuran", label: "Campuran (jumlah per tingkat)" }]} />
                {autoForm.kesulitan === "campuran" ? (["mudah", "sedang", "sulit"] as Kesulitan[]).map((level) => <Input key={level} label={`Jumlah ${level}`} type="number" min={0} max={100} required value={autoForm[level]} onChange={(event) => updateAutoForm({ [level]: event.target.value })} />) : <Input label="Jumlah Soal" required type="number" min={1} max={100} value={autoForm.jumlah} onChange={(event) => updateAutoForm({ jumlah: event.target.value })} />}
                <div className="flex items-end"><Button type="button" disabled={autoLoading} onClick={generateKandidat} className="w-full">{autoLoading ? "Menghasilkan..." : "Generate Kandidat"}</Button></div>
              </div>
              {autoError && <p className="mt-3 rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{autoError}</p>}
              {autoResult && <div className={`mt-3 rounded-input border px-3 py-2 text-sm ${autoResult.shortage > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-card-border bg-card-bg text-body-dark"}`}>{autoResult.shortage > 0 ? `Diminta ${autoResult.requested} soal ${labelTipeSoal(autoForm.tipe)}; ${autoResult.selected} kandidat valid tersedia. Kekurangan tidak diganti dengan tipe atau tingkat lain.` : `${autoResult.selected} kandidat ${labelTipeSoal(autoForm.tipe)} berhasil ditambahkan dari ${autoResult.available} soal yang tersedia.`}</div>}
            </div>
            {autoCandidates.length > 0 ? <div className="mt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-heading-dark">Kandidat terbaru ({autoCandidates.length})</p><Button type="button" size="sm" variant="outline" onClick={() => setPickerMode("manual")}>Tambah dari Manual</Button></div><div className="max-h-80 space-y-2 overflow-y-auto">{autoCandidates.map((soal) => <label key={soal.id} className="flex cursor-pointer items-start gap-3 rounded-input border border-card-border bg-card-bg p-3 transition hover:border-brand-primary/50 hover:bg-brand-primary/[0.02] focus-within:ring-2 focus-within:ring-brand-primary/25"><input type="checkbox" checked={selectedIds.includes(soal.id)} onChange={() => toggleSelect(soal.id)} className="mt-1 h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary" /><div className="min-w-0 flex-1"><span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{labelTipeSoal(soal.tipe)}</span><span className="text-xs text-text-muted">{selectedPelajaran?.nama} · Kesulitan {soal.tingkat_kesulitan ?? "-"}</span><MathContent className="prose prose-sm max-w-none" html={soal.teks_soal} /></div></label>)}</div></div> : <p className="py-8 text-center text-sm text-text-muted">Pilih kriteria lalu generate kandidat soal.</p>}
          </>
        )}

        {saveError && <p className="mt-4 rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}
        <div className="mt-4 flex items-center gap-3 border-t border-card-border pt-4">
          <Button disabled={saving} onClick={saveSelection}>{saving ? "Menyimpan..." : `Simpan (${selectedIds.length} soal)`}</Button>
          <Button variant="outline" onClick={() => router.push(listHref)}>Batal</Button>
        </div>
      </Card>
    </div>
  );
}
