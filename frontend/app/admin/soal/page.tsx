"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckSquare, ChevronRight, ClipboardList, FileText, Search, TextCursorInput, ToggleLeft } from "lucide-react";
import QuestionMetaFilters, { emptyMetaFilter, matchesMeta } from "@/components/QuestionMetaFilters";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import MathContent from "@/components/MathContent";
import Select from "@/components/Select";
import SoalPreviewDialog from "@/components/SoalPreviewDialog";
import Table from "@/components/Table";
import { useAppDialog } from "@/components/Dialog";
import { api } from "@/lib/api";
import { Kelas, Pelajaran, Soal, Subbab, Topik } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

const teksPolos = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

type Level = "tipe" | "kelas" | "pelajaran" | "bab" | "subbab" | "soal";
type Group = { key: string; value: number | string | null; label: string; items: Soal[] };

export default function SoalPage() {
  const [soal, setSoal] = useState<Soal[]>([]);
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [subbabList, setSubbabList] = useState<Subbab[]>([]);
  const [metaFilter, setMetaFilter] = useState(emptyMetaFilter);
  const [loading, setLoading] = useState(true);
  const [activeTipe, setActiveTipe] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("tipe");
  const [selectedKelas, setSelectedKelas] = useState<number | null>(null);
  const [selectedPelajaran, setSelectedPelajaran] = useState<number | null>(null);
  const [selectedBab, setSelectedBab] = useState<number | null>(null);
  const [selectedSubbab, setSelectedSubbab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [bankFilter, setBankFilter] = useState({ q: "", kelas: "", bab: "", subbab: "", kesulitan: "", status: "" });
  const { showConfirm, dialog } = useAppDialog();

  const loadData = async () => {
    try {
      const [soalRes, pelajaranRes, kelasRes, topikRes, subbabRes] = await Promise.all([
        api.get("/soal/"),
        api.get("/pelajaran/"),
        api.get("/kelas/"),
        api.get("/topik/"),
        api.get("/subbab/")
      ]);
      setSoal(soalRes.data);
      setPelajaranList(pelajaranRes.data);
      setKelasList(kelasRes.data);
      setTopikList(topikRes.data);
      setSubbabList(subbabRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: "Hapus Soal",
      description: "Soal ini akan dihapus dari bank soal.",
      confirmLabel: "Hapus Soal",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    await api.delete(`/soal/${id}`);
    await loadData();
  };

  const getNama = <T extends { id: number; nama: string }>(list: T[], id: number | null | undefined) => {
    if (id == null) return null;
    return list.find((item) => item.id === id)?.nama ?? null;
  };

  const tipeList = [
    { value: "pilihan_ganda", label: "Pilihan Ganda", subtitle: "Satu jawaban benar", icon: ClipboardList },
    { value: "pilihan_lebih_dari_satu", label: "Pilihan Lebih dari Satu", subtitle: "Beberapa jawaban benar", icon: CheckSquare },
    { value: "benar_salah", label: "Benar / Salah", subtitle: "Pernyataan benar atau salah", icon: ToggleLeft },
    { value: "esai", label: "Esai", subtitle: "Jawaban uraian", icon: FileText },
    { value: "isian", label: "Isian", subtitle: "Jawaban singkat", icon: TextCursorInput }
  ];

  const subbabFilterOptions = useMemo(() => {
    const master = subbabList.filter((item) => item.is_active && (!bankFilter.bab || String(item.topik_id) === bankFilter.bab)).map((item) => item.nama);
    const legacy = soal.filter((item) => !bankFilter.bab || String(item.topik_id) === bankFilter.bab).map((item) => item.subbab).filter((item): item is string => !!item);
    return Array.from(new Set([...master, ...legacy])).sort((a, b) => a.localeCompare(b, "id"));
  }, [bankFilter.bab, soal, subbabList]);

  const globalFiltered = useMemo(() => soal.filter((item) => matchesMeta(item, metaFilter) &&
    (!bankFilter.q || `${item.id} ${teksPolos(item.teks_soal)}`.toLowerCase().includes(bankFilter.q.toLowerCase())) &&
    (!bankFilter.kelas || String(item.kelas_id) === bankFilter.kelas) &&
    (!bankFilter.bab || String(item.topik_id) === bankFilter.bab) &&
    (!bankFilter.subbab || item.subbab === bankFilter.subbab) &&
    (!bankFilter.kesulitan || item.tingkat_kesulitan === bankFilter.kesulitan) &&
    (!bankFilter.status || item.status === bankFilter.status)), [soal, bankFilter, metaFilter]);

  const activeSoal = useMemo(() => activeTipe ? globalFiltered.filter((item) => item.tipe === activeTipe) : [], [activeTipe, globalFiltered]);
  const tipeCounts = useMemo(() => globalFiltered.reduce<Record<string, number>>((counts, item) => {
    counts[item.tipe] = (counts[item.tipe] || 0) + 1;
    return counts;
  }, {}), [globalFiltered]);

  const groupBy = (items: Soal[], getValue: (item: Soal) => number | string | null | undefined, missingLabel: string, resolve: (value: number | string | null | undefined) => string | null) => {
    const groups = new Map<string, Group>();
    items.forEach((item) => {
      const value = getValue(item) ?? null;
      const key = value == null || value === "" ? "missing" : String(value);
      if (!groups.has(key)) groups.set(key, { key, value, label: value == null || value === "" ? missingLabel : resolve(value) || missingLabel, items: [] });
      groups.get(key)!.items.push(item);
    });
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "id"));
  };

  const kelasGroups = useMemo(() => groupBy(activeSoal, (item) => item.kelas_id, "Tanpa Kelas", (value) => getNama(kelasList, Number(value))), [activeSoal, kelasList]);
  const selectedKelasSoal = useMemo(() => activeSoal.filter((item) => (selectedKelas == null ? item.kelas_id == null : item.kelas_id === selectedKelas)), [activeSoal, selectedKelas]);
  const pelajaranGroups = useMemo(() => groupBy(selectedKelasSoal, (item) => item.pelajaran_id, "Tanpa Mata Pelajaran", (value) => getNama(pelajaranList, Number(value))), [selectedKelasSoal, pelajaranList]);
  const selectedPelajaranSoal = useMemo(() => selectedKelasSoal.filter((item) => (selectedPelajaran == null ? item.pelajaran_id == null : item.pelajaran_id === selectedPelajaran)), [selectedKelasSoal, selectedPelajaran]);
  const babGroups = useMemo(() => groupBy(selectedPelajaranSoal, (item) => item.topik_id, "Tanpa Bab", (value) => getNama(topikList, Number(value))), [selectedPelajaranSoal, topikList]);
  const selectedBabSoal = useMemo(() => selectedPelajaranSoal.filter((item) => (selectedBab == null ? item.topik_id == null : item.topik_id === selectedBab)), [selectedPelajaranSoal, selectedBab]);
  const subbabGroups = useMemo(() => groupBy(selectedBabSoal, (item) => item.subbab, "Tanpa Subbab", (value) => value ? String(value) : null), [selectedBabSoal]);
  const selectedSubbabSoal = useMemo(() => selectedBabSoal.filter((item) => selectedSubbab == null ? !item.subbab : item.subbab === selectedSubbab), [selectedBabSoal, selectedSubbab]);

  const displayedGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (level === "kelas") return kelasGroups.filter((group) => !query || group.label.toLowerCase().includes(query));
    if (level === "pelajaran") return pelajaranGroups.filter((group) => !query || group.label.toLowerCase().includes(query));
    if (level === "bab") return babGroups.filter((group) => !query || group.label.toLowerCase().includes(query));
    if (level === "subbab") return subbabGroups.filter((group) => !query || group.label.toLowerCase().includes(query));
    return [];
  }, [babGroups, kelasGroups, level, pelajaranGroups, searchQuery, subbabGroups]);

  const finalSoal = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return selectedSubbabSoal.filter((item) => !query || `${item.id} ${teksPolos(item.teks_soal)}`.toLowerCase().includes(query));
  }, [searchQuery, selectedSubbabSoal]);

  const resetNavigation = () => {
    setLevel("tipe");
    setActiveTipe(null);
    setSelectedKelas(null);
    setSelectedPelajaran(null);
    setSelectedBab(null);
    setSelectedSubbab(null);
    setSearchQuery("");
  };

  const selectTipe = (tipe: string) => {
    setActiveTipe(tipe);
    setLevel("kelas");
    setSelectedKelas(null);
    setSelectedPelajaran(null);
    setSelectedBab(null);
    setSelectedSubbab(null);
    setSearchQuery("");
  };

  const selectKelas = (value: number | null) => {
    setSelectedKelas(value);
    setSelectedPelajaran(null);
    setSelectedBab(null);
    setSelectedSubbab(null);
    setLevel("pelajaran");
    setSearchQuery("");
  };

  const selectPelajaran = (value: number | null) => {
    setSelectedPelajaran(value);
    setSelectedBab(null);
    setSelectedSubbab(null);
    setLevel("bab");
    setSearchQuery("");
  };

  const selectBab = (value: number | null) => {
    setSelectedBab(value);
    setSelectedSubbab(null);
    setLevel("subbab");
    setSearchQuery("");
  };

  const selectSubbab = (value: string | null) => {
    setSelectedSubbab(value);
    setLevel("soal");
    setSearchQuery("");
  };

  const queryDefaults = () => {
    const params = new URLSearchParams();
    if (activeTipe) params.set("tipe", activeTipe);
    if (selectedKelas != null) params.set("kelas_id", String(selectedKelas));
    if (selectedPelajaran != null) params.set("pelajaran_id", String(selectedPelajaran));
    if (selectedBab != null) params.set("topik_id", String(selectedBab));
    if (selectedSubbab) params.set("subbab", selectedSubbab);
    return params.toString();
  };

  const columns = [
    { header: "ID", accessor: (row: Soal) => <span className="font-mono text-xs text-text-muted">#{row.id}</span> },
    { header: "Soal", accessor: (row: Soal) => <MathContent className="prose prose-sm max-w-none line-clamp-2" html={row.teks_soal} /> },
    { header: "Kelas", accessor: (row: Soal) => getNama(kelasList, row.kelas_id) || "Tanpa Kelas" },
    { header: "Bab", accessor: (row: Soal) => getNama(topikList, row.topik_id) || "Tanpa Bab" },
    { header: "Subbab", accessor: (row: Soal) => row.subbab || "Tanpa Subbab" },
    { header: "Kesulitan", accessor: (row: Soal) => <span className="capitalize text-xs font-medium text-text-muted">{row.tingkat_kesulitan ?? "sedang"}</span> },
    { header: "Aksi", accessor: (row: Soal) => <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setPreviewId(row.id)}>Lihat</Button><Link href={`/admin/tambah-soal?id=${row.id}`} className="inline-flex items-center justify-center rounded-btn border border-card-border bg-card-bg px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-neutral">Edit</Link><Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>Hapus</Button></div> }
  ];

  const levelTitle = level === "kelas" ? "Kelas" : level === "pelajaran" ? "Mata Pelajaran" : level === "bab" ? "Bab" : level === "subbab" ? "Subbab" : "Daftar Soal";
  const searchPlaceholder = level === "kelas" ? "Cari kelas..." : level === "pelajaran" ? "Cari mata pelajaran..." : level === "bab" ? "Cari bab..." : level === "subbab" ? "Cari subbab..." : "Cari soal / ID...";
  const contextDefaults = queryDefaults();
  const addHref = `/admin/tambah-soal${contextDefaults ? `?${contextDefaults}` : ""}`;

  if (loading) return <div className="flex min-h-screen items-center justify-center text-text-muted">Memuat data...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-heading-dark">Bank Soal</h1><p className="mt-1 text-sm text-text-muted">Telusuri, filter, dan kelola koleksi soal.</p></div>
        <Link href={addHref} className="inline-flex items-center justify-center rounded-btn bg-cta px-4 py-2 text-sm font-semibold text-heading-light transition hover:bg-cta-alt">Tambah Soal</Link>
      </header>

      <Card title="Filter bank soal">
        <QuestionMetaFilters items={soal} value={metaFilter} onChange={setMetaFilter} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Cari isi soal / ID" value={bankFilter.q} onChange={(e) => setBankFilter({ ...bankFilter, q: e.target.value })} />
          <Select label="Kelas" value={bankFilter.kelas} onChange={(e) => setBankFilter({ ...bankFilter, kelas: e.target.value })} options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((item) => ({ value: item.id, label: item.nama }))]} />
          <Select label="Bab" value={bankFilter.bab} onChange={(e) => setBankFilter({ ...bankFilter, bab: e.target.value, subbab: "" })} options={[{ value: "", label: "Semua bab" }, ...topikList.map((item) => ({ value: item.id, label: item.nama }))]} />
          <Select label="Subbab" value={bankFilter.subbab} onChange={(e) => setBankFilter({ ...bankFilter, subbab: e.target.value })} options={[{ value: "", label: "Semua subbab" }, ...subbabFilterOptions.map((item) => ({ value: item, label: item }))]} />
          <Select label="Kesulitan" value={bankFilter.kesulitan} onChange={(e) => setBankFilter({ ...bankFilter, kesulitan: e.target.value })} options={[{ value: "", label: "Semua tingkat" }, ...["mudah", "sedang", "sulit"].map((item) => ({ value: item, label: item }))]} />
          <Select label="Status" value={bankFilter.status} onChange={(e) => setBankFilter({ ...bankFilter, status: e.target.value })} options={[{ value: "", label: "Semua status" }, { value: "draft", label: "Draft" }, { value: "pending_review", label: "Menunggu review" }, { value: "approved", label: "Disetujui" }, { value: "rejected", label: "Perlu revisi" }]} />
          <Button variant="outline" onClick={() => setBankFilter({ q: "", kelas: "", bab: "", subbab: "", kesulitan: "", status: "" })}>Reset filter</Button>
        </div>
      </Card>

      <Card>
        {level === "tipe" ? (
          <>
            <div className="mb-5"><h2 className="text-lg font-bold text-heading-dark">Pilih Tipe Soal</h2><p className="mt-1 text-sm text-text-muted">Pilih kategori untuk melihat kelas dan daftar soal.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tipeList.map((tipe) => { const Icon = tipe.icon; return <button key={tipe.value} type="button" onClick={() => selectTipe(tipe.value)} className="group flex min-h-40 flex-col justify-between rounded-card border border-card-border bg-card-bg p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-card-hover"><div className="flex items-start justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="rounded-full bg-neutral px-3 py-1 text-xs font-bold text-body-dark">{tipeCounts[tipe.value] || 0} soal</span></div><div className="mt-5"><h3 className="text-base font-bold text-heading-dark group-hover:text-brand-primary">{tipe.label}</h3><p className="mt-1 text-sm text-text-muted">{tipe.subtitle}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary">Buka kategori <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></span></div></button>; })}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-3">
              <button type="button" onClick={() => { if (level === "kelas") resetNavigation(); else if (level === "pelajaran") { setLevel("kelas"); setSearchQuery(""); } else if (level === "bab") { setLevel("pelajaran"); setSearchQuery(""); } else if (level === "subbab") { setLevel("bab"); setSearchQuery(""); } else { setLevel("subbab"); setSearchQuery(""); } }} className="flex items-center gap-2 rounded-btn px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali</button>
              <div className="text-right"><div className="text-sm font-bold text-heading-dark">{labelTipeSoal(activeTipe || "")}</div><div className="text-xs text-text-muted">{levelTitle}</div></div>
            </div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-text-muted"><button type="button" onClick={resetNavigation} className="font-semibold text-brand-primary hover:underline">Tipe Soal</button><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{labelTipeSoal(activeTipe || "")}</span>{level !== "kelas" && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedKelas == null ? "Tanpa Kelas" : getNama(kelasList, selectedKelas) || "Tanpa Kelas"}</span></>}{["bab", "subbab", "soal"].includes(level) && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedPelajaran == null ? "Tanpa Mata Pelajaran" : getNama(pelajaranList, selectedPelajaran) || "Tanpa Mata Pelajaran"}</span></>}{["subbab", "soal"].includes(level) && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedBab == null ? "Tanpa Bab" : getNama(topikList, selectedBab) || "Tanpa Bab"}</span></>}{level === "soal" && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedSubbab || "Tanpa Subbab"}</span></>}</nav>
            <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={searchPlaceholder} className="w-full rounded-input border border-card-border bg-card-bg py-2.5 pl-9 pr-3 text-sm text-body-dark outline-none focus:border-brand-primary" /></div>
            {level !== "soal" ? displayedGroups.length === 0 ? <div className="rounded-card border border-card-border bg-neutral/30 p-10 text-center"><p className="text-sm text-text-muted">Tidak ada kelompok yang cocok.</p><Link href={addHref} className="mt-3 inline-flex items-center justify-center rounded-btn border border-card-border bg-card-bg px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-neutral">Buat Soal Sekarang</Link></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{displayedGroups.map((group) => <button key={group.key} type="button" onClick={() => level === "kelas" ? selectKelas(group.value as number | null) : level === "pelajaran" ? selectPelajaran(group.value as number | null) : level === "bab" ? selectBab(group.value as number | null) : selectSubbab(group.value as string | null)} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><BookOpen className="h-4 w-4" aria-hidden="true" /></span><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><div className="mt-3"><h4 className="text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h4><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></div></button>)}</div> : finalSoal.length === 0 ? <div className="rounded-card border border-card-border bg-neutral/30 p-10 text-center"><p className="text-sm text-text-muted">Tidak ada soal pada kelompok ini.</p><Link href={addHref} className="mt-3 inline-flex items-center justify-center rounded-btn border border-card-border bg-card-bg px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-neutral">Buat Soal Sekarang</Link></div> : <div className="max-h-[440px] overflow-y-auto rounded-card border border-card-border p-1"><Table data={finalSoal} columns={columns} /></div>}
          </div>
        )}
      </Card>
      <SoalPreviewDialog
        soalId={previewId}
        onClose={() => setPreviewId(null)}
        actions={(soal) => <Link href={`/admin/tambah-soal?id=${soal.id}`} className="inline-flex items-center justify-center rounded-btn border border-card-border bg-card-bg px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-neutral">Edit Soal</Link>}
      />
      {dialog}
    </div>
  );
}
