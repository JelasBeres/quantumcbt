"use client";
import QuestionMetaFilters, { emptyMetaFilter, matchesMeta } from "@/components/QuestionMetaFilters";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock3, FileQuestion, RefreshCcw } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import MathContent from "@/components/MathContent";
import Skeleton from "@/components/Skeleton";
import Select from "@/components/Select";
import Input from "@/components/Input";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Soal, Pelajaran, Kelas, Subbab, Topik } from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

type WorkflowStatus = "draft" | "pending_review" | "rejected" | "approved";
type Level = "tipe" | "kelas" | "pelajaran" | "bab" | "subbab" | "soal";
type Group = { key: string; value: number | string | null; label: string; items: Soal[] };

const STATUS: Array<{ value: WorkflowStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Menunggu Review" },
  { value: "rejected", label: "Perlu Revisi" },
  { value: "approved", label: "Disetujui" }
];

function statusClass(status: string) {
  if (status === "approved") return "border-green-200 bg-green-50 text-green-700";
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-card-border bg-neutral text-body-dark";
}

const teksPolos = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

function getNama<T extends { id: number; nama: string }>(list: T[], id: number | null | undefined) {
  if (id == null) return null;
  return list.find((item) => item.id === id)?.nama ?? null;
}

function groupBy(
  items: Soal[],
  getValue: (item: Soal) => number | string | null | undefined,
  missingLabel: string,
  resolve: (value: number | string) => string | null
): Group[] {
  const groups = new Map<string, Group>();
  items.forEach((item) => {
    const value = getValue(item) ?? null;
    const key = value == null || value === "" ? "missing" : String(value);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        value,
        label: value == null || value === "" ? missingLabel : resolve(value) || missingLabel,
        items: []
      });
    }
    groups.get(key)!.items.push(item);
  });
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "id"));
}

export default function GuruSoalPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  useEffect(() => { setUserId(getUser()?.id ?? null); }, []);
  const [items, setItems] = useState<Soal[]>([]);
  const [active, setActive] = useState<WorkflowStatus>("draft");
  const [metaFilter, setMetaFilter] = useState(emptyMetaFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ kelas: "", pelajaran: "", bab: "", subbab: "" });
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [subbabList, setSubbabList] = useState<Subbab[]>([]);
  const [level, setLevel] = useState<Level>("tipe");
  const [activeTipe, setActiveTipe] = useState<string | null>(null);
  const [selectedKelas, setSelectedKelas] = useState<number | null>(null);
  const [selectedPelajaran, setSelectedPelajaran] = useState<number | null>(null);
  const [selectedBab, setSelectedBab] = useState<number | null>(null);
  const [selectedSubbab, setSelectedSubbab] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [soalRes, scopeRes, pelajaranRes, kelasRes, topikRes, subbabRes] = await Promise.all([
        api.get("/soal/"),
        api.get("/guru-scope/me"),
        api.get("/pelajaran/"),
        api.get("/kelas/"),
        api.get("/topik/"),
        api.get("/subbab/")
      ]);
       const ownScopes = scopeRes.data ?? [];
       setItems((soalRes.data ?? []).filter((item: Soal) => ownScopes.some((scope: { pelajaran_id: number; kelas_id?: number | null }) => scope.pelajaran_id === item.pelajaran_id && (scope.kelas_id == null || scope.kelas_id === item.kelas_id))));
       setPelajaranList(pelajaranRes.data.filter((item: Pelajaran) => ownScopes.some((scope: { pelajaran_id: number }) => scope.pelajaran_id === item.id)));
      setKelasList(kelasRes.data);
       setTopikList(topikRes.data);
       setSubbabList(subbabRes.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Soal belum bisa dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const resetHierarchy = () => {
    setLevel("tipe");
    setActiveTipe(null);
    setSelectedKelas(null);
    setSelectedPelajaran(null);
    setSelectedBab(null);
    setSelectedSubbab(null);
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    items.forEach((item) => { result[item.status ?? "draft"] = (result[item.status ?? "draft"] || 0) + 1; });
    return result;
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => matchesMeta(item, metaFilter) &&
    (!query || `${item.id} ${teksPolos(item.teks_soal)}`.toLowerCase().includes(query.toLowerCase())) &&
    (!difficulty || item.tingkat_kesulitan === difficulty) &&
    (!filters.kelas || String(item.kelas_id) === filters.kelas) &&
    (!filters.pelajaran || String(item.pelajaran_id) === filters.pelajaran) &&
    (!filters.bab || String(item.topik_id) === filters.bab) &&
    (!filters.subbab || item.subbab === filters.subbab)), [items, metaFilter, query, difficulty, filters]);

  const visible = useMemo(() => filtered.filter((item) => (item.status ?? "draft") === active), [filtered, active]);
  const hierarchical = active === "draft" || active === "approved" || active === "rejected";
  const subbabOptions = useMemo(() => Array.from(new Set([
    ...subbabList.filter((item) => item.is_active && (!filters.pelajaran || String(item.pelajaran_id) === filters.pelajaran) && (!filters.bab || String(item.topik_id) === filters.bab)).map((item) => item.nama),
    ...items.filter((item) => (item.status ?? "draft") === active && matchesMeta(item, metaFilter) &&
      (!query || `${item.id} ${teksPolos(item.teks_soal)}`.toLowerCase().includes(query.toLowerCase())) &&
      (!difficulty || item.tingkat_kesulitan === difficulty) &&
      (!filters.kelas || String(item.kelas_id) === filters.kelas) &&
      (!filters.pelajaran || String(item.pelajaran_id) === filters.pelajaran) &&
      (!filters.bab || String(item.topik_id) === filters.bab))
      .map((item) => item.subbab).filter((value): value is string => !!value)
  ])).sort(), [items, subbabList, active, metaFilter, query, difficulty, filters]);

  const tipeGroups = useMemo(() => groupBy(visible, (item) => item.tipe, "Tanpa Tipe Soal", (value) => labelTipeSoal(String(value))), [visible]);
  const activeTipeSoal = useMemo(() => visible.filter((item) => (activeTipe == null ? item.tipe == null : item.tipe === activeTipe)), [visible, activeTipe]);
  const kelasGroups = useMemo(() => groupBy(activeTipeSoal, (item) => item.kelas_id, "Tanpa Kelas", (value) => getNama(kelasList, Number(value))), [activeTipeSoal, kelasList]);
  const selectedKelasSoal = useMemo(() => activeTipeSoal.filter((item) => (selectedKelas == null ? item.kelas_id == null : item.kelas_id === selectedKelas)), [activeTipeSoal, selectedKelas]);
  const pelajaranGroups = useMemo(() => groupBy(selectedKelasSoal, (item) => item.pelajaran_id, "Tanpa Mata Pelajaran", (value) => getNama(pelajaranList, Number(value))), [selectedKelasSoal, pelajaranList]);
  const selectedPelajaranSoal = useMemo(() => selectedKelasSoal.filter((item) => (selectedPelajaran == null ? item.pelajaran_id == null : item.pelajaran_id === selectedPelajaran)), [selectedKelasSoal, selectedPelajaran]);
  const babGroups = useMemo(() => groupBy(selectedPelajaranSoal, (item) => item.topik_id, "Tanpa Bab", (value) => getNama(topikList, Number(value))), [selectedPelajaranSoal, topikList]);
  const selectedBabSoal = useMemo(() => selectedPelajaranSoal.filter((item) => (selectedBab == null ? item.topik_id == null : item.topik_id === selectedBab)), [selectedPelajaranSoal, selectedBab]);
  const subbabGroups = useMemo(() => groupBy(selectedBabSoal, (item) => item.subbab, "Tanpa Subbab", (value) => String(value)), [selectedBabSoal]);
  const selectedSubbabSoal = useMemo(() => selectedBabSoal.filter((item) => selectedSubbab == null ? !item.subbab : item.subbab === selectedSubbab), [selectedBabSoal, selectedSubbab]);
  const legacyGroups = useMemo(() => {
    const groups = new Map<string, { title: string; items: Soal[] }>();
    visible.forEach((item) => {
      const key = JSON.stringify([item.kelas_id, item.pelajaran_id, item.topik_id, item.subbab]);
      if (!groups.has(key)) groups.set(key, {
        title: [getNama(kelasList, item.kelas_id) || "Tanpa Kelas", getNama(pelajaranList, item.pelajaran_id) || "Tanpa Mata Pelajaran", getNama(topikList, item.topik_id) || "Tanpa Bab", item.subbab || "Tanpa Subbab"].join(" / "),
        items: []
      });
      groups.get(key)!.items.push(item);
    });
    return Array.from(groups.entries());
  }, [visible, kelasList, pelajaranList, topikList]);

  const action = async (item: Soal, kind: "submit" | "withdraw" | "revision") => {
    setBusyId(item.id);
    setError("");
    try {
      if (kind === "submit") await api.post(`/soal/${item.id}/submit-review`, {});
      if (kind === "withdraw") await api.post(`/soal/${item.id}/withdraw-review`, {});
      if (kind === "revision") {
        const response = await api.post(`/soal/${item.id}/revision`);
        router.push(`/guru/soal/tambah?id=${response.data.id}`);
        return;
      }
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Aksi soal gagal diproses."));
    } finally {
      setBusyId(null);
    }
  };

  const renderQuestionCard = (item: Soal) => {
    const itemStatus = item.status ?? "draft";
    return (
      <Card key={item.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-text-muted"><span className="font-mono font-semibold text-heading-dark">#{item.id}</span><span>·</span><span>{labelTipeSoal(item.tipe)}</span><span>·</span><span className="capitalize">{item.tingkat_kesulitan ?? "sedang"}</span><span>·</span><span>v{item.version ?? 1}</span></div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(itemStatus)}`}>{STATUS.find((status) => status.value === itemStatus)?.label ?? itemStatus}</span>
        </div>
        <MathContent className="prose prose-sm mt-4 max-w-none line-clamp-4" html={item.teks_soal} />
        {item.rejection_reason && <div className="mt-4 rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700"><strong>Catatan admin:</strong> {item.rejection_reason}</div>}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-card-border pt-4">
          {(itemStatus === "draft" || itemStatus === "rejected") && <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => router.push(`/guru/soal/tambah?id=${item.id}`)}>Edit Soal</Button>}
          {(itemStatus === "draft" || itemStatus === "rejected") && <Button size="sm" disabled={busyId === item.id} onClick={() => action(item, "submit")}><Clock3 className="mr-1 h-4 w-4" /> Ajukan Review</Button>}
          {itemStatus === "pending_review" && <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => action(item, "withdraw")}><RefreshCcw className="mr-1 h-4 w-4" /> Tarik Pengajuan</Button>}
          {itemStatus === "approved" && userId !== null && item.created_by !== userId && <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => action(item, "revision")}><CheckCircle2 className="mr-1 h-4 w-4" /> Edit Soal (Revisi)</Button>}
          {itemStatus === "approved" && userId !== null && item.created_by === userId && <p className="text-xs text-text-muted">Soal milik Anda. Revisi hanya dapat dilakukan oleh guru lain.</p>}
        </div>
      </Card>
    );
  };

  const renderQuestionCards = (questionItems: Soal[]) => <div className="grid gap-4 md:grid-cols-2 max-h-[560px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{questionItems.map(renderQuestionCard)}</div>;
  const setActiveStatus = (status: WorkflowStatus) => { setActive(status); resetHierarchy(); };
  const setMetaFilters = (value: typeof emptyMetaFilter) => { setMetaFilter(value); resetHierarchy(); };
  const updateFilters = (value: typeof filters) => { setFilters(value); resetHierarchy(); };
  const levelTitle = level === "tipe" ? "Tipe Soal" : level === "kelas" ? "Kelas" : level === "pelajaran" ? "Mata Pelajaran" : level === "bab" ? "Bab" : level === "subbab" ? "Subbab" : "Daftar Soal";
  const selectedTipeLabel = activeTipe == null ? "Tanpa Tipe Soal" : labelTipeSoal(activeTipe);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Bank soal guru</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Kelola Soal</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola draft sendiri dan revisi soal guru lain yang sudah disetujui sesuai penugasan. Revisi diperiksa admin sebelum diterbitkan.</p>
        </div>
        <Button onClick={() => router.push("/guru/soal/tambah")}>Buat Soal</Button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-card-border pb-3">
        {STATUS.map((status) => (
          <button key={status.value} type="button" onClick={() => setActiveStatus(status.value)} className={`rounded-btn border px-3 py-2 text-sm font-semibold transition ${active === status.value ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-card-border bg-card-bg text-text-muted hover:text-body-dark"}`}>
            {status.label} ({counts[status.value] || 0})
          </button>
        ))}
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <Card title="Kelompok soal">
        <QuestionMetaFilters items={items} value={metaFilter} onChange={setMetaFilters} />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Input label="Cari isi soal / ID" value={query} onChange={(e) => { setQuery(e.target.value); resetHierarchy(); }} />
          <Select label="Kesulitan" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); resetHierarchy(); }} options={[{ value: "", label: "Semua tingkat" }, ...["mudah", "sedang", "sulit"].map((s) => ({ value: s, label: s }))]} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Kelas" value={filters.kelas} onChange={(e) => updateFilters({ kelas: e.target.value, pelajaran: "", bab: "", subbab: "" })} options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]} />
          <Select label="Mapel" value={filters.pelajaran} onChange={(e) => updateFilters({ ...filters, pelajaran: e.target.value, bab: "", subbab: "" })} options={[{ value: "", label: "Semua mapel" }, ...pelajaranList.map((p) => ({ value: p.id, label: p.nama }))]} />
          <Select label="Bab" value={filters.bab} onChange={(e) => updateFilters({ ...filters, bab: e.target.value, subbab: "" })} options={[{ value: "", label: "Semua bab" }, ...topikList.filter((t) => !filters.pelajaran || String(t.pelajaran_id) === filters.pelajaran).map((t) => ({ value: t.id, label: t.nama }))]} />
          <Select label="Subbab" value={filters.subbab} onChange={(e) => updateFilters({ ...filters, subbab: e.target.value })} options={[{ value: "", label: "Semua subbab" }, ...subbabOptions.map((s) => ({ value: s, label: s }))]} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-text-muted">
          <span>{visible.length} soal sesuai filter dan status</span>
          <Button variant="outline" size="sm" onClick={() => updateFilters({ kelas: "", pelajaran: "", bab: "", subbab: "" })}>Reset filter</Button>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<FileQuestion className="h-6 w-6" />} title={`Tidak ada soal ${STATUS.find((s) => s.value === active)?.label.toLowerCase()}`} description="Soal Anda akan muncul di sini sesuai status workflow." />
      ) : hierarchical ? (
        <Card title="Hierarki soal">
          {level === "tipe" ? (
            <>
              <div className="mb-5"><h2 className="text-lg font-bold text-heading-dark">Pilih Tipe Soal</h2><p className="mt-1 text-sm text-text-muted">Pilih kategori untuk melihat kelas dan daftar soal.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tipeGroups.map((group) => <button key={group.key} type="button" onClick={() => { setActiveTipe(group.value as string | null); setLevel("kelas"); setSelectedKelas(null); setSelectedPelajaran(null); setSelectedBab(null); setSelectedSubbab(null); }} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><BookOpen className="h-4 w-4" aria-hidden="true" /></span><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><div className="mt-3"><h3 className="text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h3><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></div></button>)}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-3">
                <button type="button" onClick={() => { if (level === "kelas") { resetHierarchy(); } else if (level === "pelajaran") { setLevel("kelas"); setSelectedPelajaran(null); setSelectedBab(null); setSelectedSubbab(null); } else if (level === "bab") { setLevel("pelajaran"); setSelectedBab(null); setSelectedSubbab(null); } else if (level === "subbab") { setLevel("bab"); setSelectedSubbab(null); } else { setLevel("subbab"); } }} className="flex items-center gap-2 rounded-btn px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali</button>
                <div className="text-right"><div className="text-sm font-bold text-heading-dark">{selectedTipeLabel}</div><div className="text-xs text-text-muted">{levelTitle}</div></div>
              </div>
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-text-muted"><button type="button" onClick={resetHierarchy} className="font-semibold text-brand-primary hover:underline">Tipe Soal</button><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedTipeLabel}</span>{level !== "kelas" && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedKelas == null ? "Tanpa Kelas" : getNama(kelasList, selectedKelas) || "Tanpa Kelas"}</span></>}{["bab", "subbab", "soal"].includes(level) && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedPelajaran == null ? "Tanpa Mata Pelajaran" : getNama(pelajaranList, selectedPelajaran) || "Tanpa Mata Pelajaran"}</span></>}{["subbab", "soal"].includes(level) && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedBab == null ? "Tanpa Bab" : getNama(topikList, selectedBab) || "Tanpa Bab"}</span></>}{level === "soal" && <><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{selectedSubbab || "Tanpa Subbab"}</span></>}</nav>
              {level === "kelas" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{kelasGroups.map((group) => <button key={group.key} type="button" onClick={() => { setSelectedKelas(group.value as number | null); setSelectedPelajaran(null); setSelectedBab(null); setSelectedSubbab(null); setLevel("pelajaran"); }} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><BookOpen className="h-4 w-4 text-brand-primary" /><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><h3 className="mt-3 text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h3><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></button>)}</div>}
              {level === "pelajaran" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{pelajaranGroups.map((group) => <button key={group.key} type="button" onClick={() => { setSelectedPelajaran(group.value as number | null); setSelectedBab(null); setSelectedSubbab(null); setLevel("bab"); }} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><BookOpen className="h-4 w-4 text-brand-primary" /><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><h3 className="mt-3 text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h3><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></button>)}</div>}
              {level === "bab" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{babGroups.map((group) => <button key={group.key} type="button" onClick={() => { setSelectedBab(group.value as number | null); setSelectedSubbab(null); setLevel("subbab"); }} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><BookOpen className="h-4 w-4 text-brand-primary" /><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><h3 className="mt-3 text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h3><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></button>)}</div>}
              {level === "subbab" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto rounded-card border border-card-border bg-neutral/30 p-3">{subbabGroups.map((group) => <button key={group.key} type="button" onClick={() => { setSelectedSubbab(group.value as string | null); setLevel("soal"); }} className="group flex flex-col justify-between rounded-card border border-card-border bg-card-bg p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"><div className="flex items-start justify-between gap-2"><BookOpen className="h-4 w-4 text-brand-primary" /><span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-text-muted">{group.items.length} soal</span></div><h3 className="mt-3 text-sm font-bold text-heading-dark group-hover:text-brand-primary">{group.label}</h3><p className="mt-1 flex items-center gap-1 text-xs text-text-muted">Klik untuk buka <ChevronRight className="h-3 w-3" aria-hidden="true" /></p></button>)}</div>}
              {level === "soal" && renderQuestionCards(selectedSubbabSoal)}
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">{legacyGroups.map(([key, group]) => <section key={key} className="space-y-3"><h2 className="text-sm font-semibold text-heading-dark">{group.title} ({group.items.length})</h2>{renderQuestionCards(group.items)}</section>)}</div>
      )}

    </div>
  );
}
