"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { useAppDialog } from "@/components/Dialog";
import { JadwalUjian, KategoriPaket, Kelas, PaketUjian, Program } from "@/lib/types";
import Input from "@/components/Input";
import ResetFilterButton from "@/components/ResetFilterButton";

type TimeStatus = "berlangsung" | "akan_datang" | "selesai" | "tidak_valid";
type GroupItem = { key: string; label: string; count: number; packageCount: number };
type PackageFilters = { q: string; kategori: string; program: string; kelas: string };

const initialForm = { paket_ujian_id: "", mulai: "", selesai: "" };
const initialPackageFilters: PackageFilters = { q: "", kategori: "", program: "", kelas: "" };
const packagePageSize = 10;
const timeStatuses: Array<{ key: TimeStatus; label: string; description: string }> = [
  { key: "berlangsung", label: "Berlangsung", description: "Jadwal yang sedang berjalan" },
  { key: "akan_datang", label: "Akan Datang", description: "Jadwal yang belum dimulai" },
  { key: "selesai", label: "Selesai", description: "Jadwal yang telah berakhir" }
];

const fieldClass = "w-full rounded-input border border-card-border bg-card-bg p-2.5 text-sm text-body-dark transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/25";
const primaryButtonClass = "rounded-btn bg-cta px-4 py-2 text-sm font-semibold text-white transition hover:bg-cta-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const outlineButtonClass = "rounded-btn border border-card-border bg-card-bg px-4 py-2 text-sm font-semibold text-body-dark transition hover:bg-neutral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function getTimeStatus(item: JadwalUjian, now: number): TimeStatus {
  const start = new Date(item.mulai).getTime();
  const end = new Date(item.selesai).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return "tidak_valid";
  if (now < start) return "akan_datang";
  if (now <= end) return "berlangsung";
  return "selesai";
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

type ChipOption = { value: string; label: string; count: number };

// Tombol filter sekali klik, gayanya sama dengan filter kategori di Monitoring Ujian.
function ChipFilter({ label, value, options, onChange }: { label: string; value: string; options: ChipOption[]; onChange: (value: string) => void }) {
  const visible = options.filter((option) => option.count > 0 || option.value === value);
  const chipClass = (active: boolean) =>
    `rounded-btn border px-3 py-1.5 text-sm font-semibold transition ${active ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-card-border bg-card-bg text-text-muted hover:text-body-dark"}`;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-full text-xs font-semibold uppercase tracking-wide text-text-muted sm:w-20">{label}</span>
      <button type="button" onClick={() => onChange("")} aria-pressed={value === ""} className={chipClass(value === "")}>Semua</button>
      {visible.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(value === option.value ? "" : option.value)} aria-pressed={value === option.value} className={chipClass(value === option.value)}>
          {option.label} <span className="ml-1 text-xs font-normal opacity-70">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function DrilldownCard({ item, onClick }: { item: GroupItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={item.count === 0}
      className="group flex min-h-28 w-full items-center justify-between gap-4 rounded-card border border-card-border bg-card-bg p-4 text-left shadow-card transition hover:border-brand-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
    >
      <span className="min-w-0">
        <span className="block font-bold text-heading-dark">{item.label}</span>
        <span className="mt-1 block text-sm text-text-muted">
          {item.count} jadwal · {item.packageCount} paket Try Out
        </span>
      </span>
      <span aria-hidden="true" className="text-xl text-brand-primary transition group-hover:translate-x-1">→</span>
    </button>
  );
}

export default function JadwalUjianPage() {
  const [jadwal, setJadwal] = useState<JadwalUjian[]>([]);
  const [paketList, setPaketList] = useState<PaketUjian[]>([]);
  const [programList, setProgramList] = useState<Program[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriPaket[]>([]);
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRef, setEditingRef] = useState<JadwalUjian | null>(null);
  const [packageFilters, setPackageFilters] = useState<PackageFilters>(initialPackageFilters);
  const [packagePage, setPackagePage] = useState(1);
  const [selectedTimeStatus, setSelectedTimeStatus] = useState<TimeStatus | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { showPrompt, dialog } = useAppDialog();

  const paketById = useMemo(() => new Map(paketList.map((item) => [item.id, item])), [paketList]);
  const programById = useMemo(() => new Map(programList.map((item) => [item.id, item])), [programList]);
  const kelasById = useMemo(() => new Map(kelasList.map((item) => [item.id, item])), [kelasList]);
  const kategoriById = useMemo(() => new Map(kategoriList.map((item) => [item.id, item])), [kategoriList]);

  const getCategoryIdentity = (paket?: PaketUjian) => {
    if (paket?.kategori_id != null) {
      return {
        key: `kategori:${paket.kategori_id}`,
        label: paket.kategori_nama?.trim() || kategoriById.get(paket.kategori_id)?.nama || `Kategori #${paket.kategori_id}`
      };
    }
    if (paket?.kategori_nama?.trim()) {
      return { key: `nama:${paket.kategori_nama.trim()}`, label: paket.kategori_nama.trim() };
    }
    return { key: "tanpa-kategori", label: "Belum Dikategorikan" };
  };

  const getEffectiveProgramId = (item: JadwalUjian, paket?: PaketUjian) => item.program_id ?? paket?.program_id ?? null;
  const getEffectiveClassId = (item: JadwalUjian, paket?: PaketUjian) => item.kelas_id ?? paket?.kelas_id ?? null;
  const getProgramName = (id: number | null) => id == null ? "Semua Program" : programById.get(id)?.nama || `Program #${id}`;
  const getClassName = (id: number | null) => id == null ? "Semua Kelas" : kelasById.get(id)?.nama || `Kelas #${id}`;

  const load = async () => {
    setLoading(true);
    try {
      const [jadwalRes, paketRes, programRes, kelasRes, kategoriRes] = await Promise.all([
        api.get("/jadwal-ujian"),
        api.get("/paket-ujian"),
        api.get("/program/"),
        api.get("/kelas/"),
        api.get("/kategori-paket/")
      ]);
      setJadwal(jadwalRes.data ?? []);
      setPaketList((paketRes.data ?? []).filter((item: PaketUjian) => item.tipe === "ujian"));
      setProgramList(programRes.data ?? []);
      setKelasList(kelasRes.data ?? []);
      setKategoriList(kategoriRes.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Gagal memuat jadwal ujian."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedTimeStatus(null);
    setSelectedCategory(null);
    setSelectedProgram(null);
  }, [period.from, period.to]);

  const selectedPackage = form.paket_ujian_id ? paketById.get(Number(form.paket_ujian_id)) : undefined;

  const packageChoices = useMemo(() => {
    return paketList.filter((item) => {
      const isCurrentEditingPackage = editingId !== null && item.id === Number(form.paket_ujian_id);
      return isCurrentEditingPackage || (!item.is_archived && item.tipe === "ujian" && item.siap_dipublikasikan === true);
    });
  }, [editingId, form.paket_ujian_id, paketList]);

  const filteredPackageChoices = useMemo(() => {
    const query = packageFilters.q.trim().toLowerCase();
    return packageChoices
      .filter((item) => !query || `${item.nama} ${item.id}`.toLowerCase().includes(query))
      .filter((item) => !packageFilters.kategori || String(item.kategori_id ?? "tanpa-kategori") === packageFilters.kategori)
      .filter((item) => !packageFilters.program || String(item.program_id ?? "semua-program") === packageFilters.program)
      .filter((item) => !packageFilters.kelas || String(item.kelas_id ?? "semua-kelas") === packageFilters.kelas)
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [packageChoices, packageFilters]);

  const packagePageCount = Math.max(1, Math.ceil(filteredPackageChoices.length / packagePageSize));
  const currentPackagePage = Math.min(packagePage, packagePageCount);
  const visiblePackageChoices = filteredPackageChoices.slice(
    (currentPackagePage - 1) * packagePageSize,
    currentPackagePage * packagePageSize
  );

  const updatePackageFilter = (key: keyof PackageFilters, value: string) => {
    setPackageFilters((current) => ({ ...current, [key]: value }));
    setPackagePage(1);
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingRef(null);
    setForm(initialForm);
    setPackageFilters(initialPackageFilters);
    setPackagePage(1);
  };

  const submitJadwal = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.paket_ujian_id) {
      setError("Pilih paket Try Out yang akan dijadwalkan.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        paket_ujian_id: Number(form.paket_ujian_id),
        program_id: selectedPackage?.program_id ?? null,
        kelas_id: selectedPackage?.kelas_id ?? null,
        mulai: new Date(form.mulai).toISOString(),
        selesai: new Date(form.selesai).toISOString(),
        is_published: editingRef?.is_published ?? false
      };
      if (editingId) {
        await api.put(`/jadwal-ujian/${editingId}`, payload);
      } else {
        await api.post("/jadwal-ujian", payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, editingId ? "Gagal memperbarui jadwal." : "Gagal menyimpan jadwal."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: JadwalUjian) => {
    setEditingRef(item);
    setEditingId(item.id);
    setForm({
      paket_ujian_id: String(item.paket_ujian_id),
      mulai: toLocalDateTime(item.mulai),
      selesai: toLocalDateTime(item.selesai)
    });
    setPackageFilters(initialPackageFilters);
    setPackagePage(1);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteJadwal = async (item: JadwalUjian) => {
    const paket = paketById.get(item.paket_ujian_id);
    const judul = paket?.nama || `Paket #${item.paket_ujian_id}`;
    const alasan = await showPrompt({
      title: "Hapus Jadwal Ujian",
      description: `Jadwal "${judul}" akan dihapus dari daftar aktif. Alasan penghapusan disimpan sebagai catatan audit.`,
      inputLabel: "Alasan penghapusan",
      placeholder: "Contoh: jadwal bentrok dan diganti sesi baru",
      confirmLabel: "Hapus Jadwal",
      confirmVariant: "danger",
      minLength: 3
    });
    if (alasan === null) return;
    setError("");
    setBusyId(item.id);
    try {
      await api.delete(`/jadwal-ujian/${item.id}`, { data: { alasan } });
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menghapus jadwal."));
    } finally {
      setBusyId(null);
    }
  };

  const togglePublish = async (item: JadwalUjian) => {
    setError("");
    setBusyId(item.id);
    try {
      await api.patch(`/jadwal-ujian/${item.id}/publish`, { is_published: !item.is_published });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal mengubah status publikasi jadwal."));
    } finally {
      setBusyId(null);
    }
  };

  const filteredJadwal = useMemo(() => {
    const from = period.from ? new Date(`${period.from}T00:00:00`).getTime() : null;
    const to = period.to ? new Date(`${period.to}T23:59:59.999`).getTime() : null;
    return jadwal
      .filter((item) => {
        // Jadwal masuk rentang bila waktunya beririsan dengan tanggal yang dipilih.
        const start = new Date(item.mulai).getTime();
        const end = new Date(item.selesai).getTime();
        return (from === null || end >= from) && (to === null || start <= to);
      })
      .sort((a, b) => b.id - a.id);
  }, [jadwal, period.from, period.to]);

  const scheduleGroupItem = (key: string, label: string, items: JadwalUjian[]): GroupItem => ({
    key,
    label,
    count: items.length,
    packageCount: new Set(items.map((item) => item.paket_ujian_id)).size
  });

  const statusCards = timeStatuses.map((status) => {
    const items = filteredJadwal.filter((item) => getTimeStatus(item, now) === status.key);
    return { ...scheduleGroupItem(status.key, status.label, items), description: status.description };
  });
  const invalidSchedules = filteredJadwal.filter((item) => getTimeStatus(item, now) === "tidak_valid");
  if (invalidSchedules.length > 0) {
    statusCards.push({
      ...scheduleGroupItem("tidak_valid", "Waktu Tidak Valid", invalidSchedules),
      description: "Jadwal dengan rentang waktu yang perlu diperbaiki"
    });
  }

  const statusSchedules = selectedTimeStatus
    ? filteredJadwal.filter((item) => getTimeStatus(item, now) === selectedTimeStatus)
    : [];

  const categoryGroups = Array.from(
    statusSchedules.reduce((groups, item) => {
      const identity = getCategoryIdentity(paketById.get(item.paket_ujian_id));
      const current = groups.get(identity.key) ?? { label: identity.label, items: [] as JadwalUjian[] };
      current.items.push(item);
      groups.set(identity.key, current);
      return groups;
    }, new Map<string, { label: string; items: JadwalUjian[] }>())
  )
    .map(([key, value]) => scheduleGroupItem(key, value.label, value.items))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));

  const categorySchedules = selectedCategory
    ? statusSchedules.filter((item) => getCategoryIdentity(paketById.get(item.paket_ujian_id)).key === selectedCategory)
    : [];

  const programGroups = Array.from(
    categorySchedules.reduce((groups, item) => {
      const paket = paketById.get(item.paket_ujian_id);
      const id = getEffectiveProgramId(item, paket);
      const key = id == null ? "semua-program" : `program:${id}`;
      const current = groups.get(key) ?? { label: getProgramName(id), items: [] as JadwalUjian[] };
      current.items.push(item);
      groups.set(key, current);
      return groups;
    }, new Map<string, { label: string; items: JadwalUjian[] }>())
  )
    .map(([key, value]) => scheduleGroupItem(key, value.label, value.items))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));

  const programSchedules = selectedProgram
    ? categorySchedules.filter((item) => {
        const id = getEffectiveProgramId(item, paketById.get(item.paket_ujian_id));
        return (id == null ? "semua-program" : `program:${id}`) === selectedProgram;
      })
    : [];

  const selectedTimeLabel = statusCards.find((item) => item.key === selectedTimeStatus)?.label;
  const selectedCategoryLabel = categoryGroups.find((item) => item.key === selectedCategory)?.label;
  const selectedProgramLabel = programGroups.find((item) => item.key === selectedProgram)?.label;
  const examCategories = kategoriList.filter((item) => item.tipe === "ujian" || item.tipe === "keduanya");

  // Pilihan tombol filter paket: hanya yang punya paket siap, lengkap dengan jumlahnya.
  const countPackages = (match: (item: PaketUjian) => boolean) => packageChoices.filter(match).length;
  const packageCategoryChips = [
    ...examCategories.map((item) => ({ value: String(item.id), label: item.nama, count: countPackages((p) => p.kategori_id === item.id) })),
    { value: "tanpa-kategori", label: "Belum Dikategorikan", count: countPackages((p) => p.kategori_id == null) }
  ];
  const packageProgramChips = [
    ...programList.map((item) => ({ value: String(item.id), label: item.nama, count: countPackages((p) => p.program_id === item.id) })),
    { value: "semua-program", label: "Semua Program", count: countPackages((p) => p.program_id == null) }
  ];
  const packageClassChips = [
    ...kelasList.map((item) => ({ value: String(item.id), label: item.nama, count: countPackages((p) => p.kelas_id === item.id) })),
    { value: "semua-kelas", label: "Semua Kelas", count: countPackages((p) => p.kelas_id == null) }
  ];

  return (
    <main className="min-h-screen bg-transparent py-0 sm:py-4">
      <section className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <header>
          <p className="text-sm font-semibold text-brand-primary">Administrasi Ujian</p>
          <h1 className="text-3xl font-bold text-heading-dark">Jadwal Ujian</h1>
          <p className="mt-1 text-sm text-text-muted">Atur jadwal dan telusuri daftar berdasarkan status waktu, kategori, lalu program.</p>
        </header>

        {error && (
          <div role="alert" className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submitJadwal} className="space-y-5 rounded-card border border-card-border bg-card-bg p-4 shadow-card sm:p-5">
          <div>
            <h2 className="font-bold text-heading-dark">{editingId ? `Edit Jadwal #${editingId}` : "Tambah Jadwal"}</h2>
            <p className="mt-1 text-xs text-text-muted">Hanya paket Try Out aktif dan siap dipublikasikan yang tersedia untuk jadwal baru.</p>
          </div>

          {selectedPackage && (
            <div className="rounded-input border border-brand-primary/30 bg-brand-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Paket terpilih</p>
                  <p className="mt-1 font-bold text-heading-dark">{selectedPackage.nama}</p>
                  <p className="mt-1 text-sm text-text-muted">
                    {getCategoryIdentity(selectedPackage).label} · {getProgramName(selectedPackage.program_id ?? null)} · {getClassName(selectedPackage.kelas_id ?? null)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedPackage.siap_dipublikasikan ? "border border-green-200 bg-green-50 text-green-700" : "border border-amber-200 bg-amber-50 text-amber-800"}`}>
                  {selectedPackage.siap_dipublikasikan ? "Siap dijadwalkan" : "Belum siap · dipertahankan saat edit"}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{selectedPackage.jumlah_soal} soal · {selectedPackage.durasi_menit} menit · ID paket {selectedPackage.id}</p>
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-heading-dark">Pilih Paket Try Out</legend>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-md">
                <Input
                  label="Cari paket / ID paket"
                  value={packageFilters.q}
                  onChange={(event) => updatePackageFilter("q", event.target.value)}
                  placeholder="Nama atau ID paket"
                />
              </div>
              <ResetFilterButton
                active={Object.values(packageFilters).some(Boolean)}
                onReset={() => { setPackageFilters(initialPackageFilters); setPackagePage(1); }}
              />
            </div>
            <ChipFilter label="Kategori" value={packageFilters.kategori} options={packageCategoryChips} onChange={(value) => updatePackageFilter("kategori", value)} />
            <ChipFilter label="Program" value={packageFilters.program} options={packageProgramChips} onChange={(value) => updatePackageFilter("program", value)} />
            <ChipFilter label="Kelas" value={packageFilters.kelas} options={packageClassChips} onChange={(value) => updatePackageFilter("kelas", value)} />

            <div className="space-y-2" aria-live="polite">
              {visiblePackageChoices.map((item) => {
                const selected = form.paket_ujian_id === String(item.id);
                return (
                  <label
                    key={item.id}
                    className={`block cursor-pointer rounded-input border p-3 transition focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2 ${selected ? "border-brand-primary bg-brand-primary/5" : "border-card-border hover:border-brand-primary/50"}`}
                  >
                    <input
                      type="radio"
                      name="paket_ujian_id"
                      value={item.id}
                      checked={selected}
                      onChange={(event) => setForm((current) => ({ ...current, paket_ujian_id: event.target.value }))}
                      className="sr-only"
                    />
                    <span className="flex flex-wrap items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold text-heading-dark">{item.nama}</span>
                        <span className="mt-1 block text-xs text-text-muted">
                          {getCategoryIdentity(item).label} · {getProgramName(item.program_id ?? null)} · {getClassName(item.kelas_id ?? null)}
                        </span>
                        <span className="mt-1 block text-xs text-text-muted">{item.jumlah_soal} soal · {item.durasi_menit} menit · ID {item.id}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.siap_dipublikasikan ? "border border-green-200 bg-green-50 text-green-700" : "border border-amber-200 bg-amber-50 text-amber-800"}`}>
                        {item.siap_dipublikasikan ? "Siap" : "Belum siap"}
                      </span>
                    </span>
                  </label>
                );
              })}
              {visiblePackageChoices.length === 0 && (
                <p className="rounded-input border border-dashed border-card-border p-5 text-center text-sm text-text-muted">
                  Tidak ada paket siap yang sesuai pencarian dan filter.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-text-muted">{filteredPackageChoices.length} paket cocok</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPackagePage(Math.max(1, currentPackagePage - 1))}
                  disabled={currentPackagePage === 1}
                  className={outlineButtonClass}
                >
                  Sebelumnya
                </button>
                <span className="min-w-24 text-center text-text-muted">Halaman {currentPackagePage} / {packagePageCount}</span>
                <button
                  type="button"
                  onClick={() => setPackagePage(Math.min(packagePageCount, currentPackagePage + 1))}
                  disabled={currentPackagePage === packagePageCount}
                  className={outlineButtonClass}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              required
              label="Waktu mulai"
              type="datetime-local"
              value={form.mulai}
              onChange={(event) => setForm((current) => ({ ...current, mulai: event.target.value }))}
            />
            <Input
              required
              label="Waktu selesai"
              type="datetime-local"
              value={form.selesai}
              onChange={(event) => setForm((current) => ({ ...current, selesai: event.target.value }))}
            />
          </div>
          <p className="text-xs text-text-muted">Program dan kelas jadwal mengikuti paket yang dipilih secara otomatis.</p>

          <div className="flex flex-wrap gap-2">
            <button disabled={saving} className={primaryButtonClass}>
              {saving ? "Menyimpan..." : editingId ? "Perbarui Jadwal" : "Simpan Jadwal"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} disabled={saving} className={outlineButtonClass}>Batal</button>
            )}
          </div>
        </form>

        <section className="space-y-5 rounded-card border border-card-border bg-card-bg p-4 shadow-card sm:p-5">
          <div>
            <h2 className="font-bold text-heading-dark">Filter Daftar Jadwal</h2>
            <p className="mt-1 text-xs text-text-muted">Tampilkan jadwal yang berjalan pada rentang tanggal ini. Kosongkan untuk melihat semua.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Input
              label="Dari tanggal"
              type="date"
              value={period.from}
              onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))}
            />
            <Input
              label="Sampai tanggal"
              type="date"
              min={period.from || undefined}
              value={period.to}
              onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))}
            />
          </div>
          <ResetFilterButton active={Boolean(period.from || period.to)} onReset={() => setPeriod({ from: "", to: "" })} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-heading-dark">Daftar Jadwal</h2>
              <p className="mt-1 text-sm text-text-muted">{filteredJadwal.length} jadwal sesuai filter</p>
            </div>
            {selectedTimeStatus && (
              <button
                type="button"
                onClick={() => {
                  if (selectedProgram) setSelectedProgram(null);
                  else if (selectedCategory) setSelectedCategory(null);
                  else setSelectedTimeStatus(null);
                }}
                className={outlineButtonClass}
              >
                Kembali
              </button>
            )}
          </div>

          <nav aria-label="Hierarki jadwal" className="overflow-x-auto">
            <ol className="flex min-w-max items-center gap-2 text-sm text-text-muted">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTimeStatus(null);
                    setSelectedCategory(null);
                    setSelectedProgram(null);
                  }}
                  className={!selectedTimeStatus ? "font-semibold text-heading-dark" : "hover:text-brand-primary"}
                  aria-current={!selectedTimeStatus ? "page" : undefined}
                >
                  Status Waktu
                </button>
              </li>
              {selectedTimeStatus && (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSelectedProgram(null);
                      }}
                      className={!selectedCategory ? "font-semibold text-heading-dark" : "hover:text-brand-primary"}
                      aria-current={!selectedCategory ? "page" : undefined}
                    >
                      {selectedTimeLabel}
                    </button>
                  </li>
                </>
              )}
              {selectedCategory && (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedProgram(null)}
                      className={!selectedProgram ? "font-semibold text-heading-dark" : "hover:text-brand-primary"}
                      aria-current={!selectedProgram ? "page" : undefined}
                    >
                      {selectedCategoryLabel}
                    </button>
                  </li>
                </>
              )}
              {selectedProgram && (
                <>
                  <li aria-hidden="true">/</li>
                  <li className="font-semibold text-heading-dark" aria-current="page">{selectedProgramLabel}</li>
                  <li aria-hidden="true">/</li>
                  <li className="font-semibold text-heading-dark">Paket Try Out / Jadwal</li>
                </>
              )}
            </ol>
          </nav>

          {loading ? (
            <div className="space-y-3">
              <div className="h-28 animate-pulse rounded-card bg-neutral" />
              <div className="h-28 animate-pulse rounded-card bg-neutral" />
            </div>
          ) : !selectedTimeStatus ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {statusCards.map((item) => (
                <DrilldownCard
                  key={item.key}
                  item={item}
                  onClick={() => {
                    setSelectedTimeStatus(item.key as TimeStatus);
                    setSelectedCategory(null);
                    setSelectedProgram(null);
                  }}
                />
              ))}
            </div>
          ) : !selectedCategory ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-heading-dark">Kategori · {selectedTimeLabel}</h3>
                <p className="text-sm text-text-muted">Pilih kategori untuk melihat program di dalamnya.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {categoryGroups.map((item) => (
                  <DrilldownCard
                    key={item.key}
                    item={item}
                    onClick={() => {
                      setSelectedCategory(item.key);
                      setSelectedProgram(null);
                    }}
                  />
                ))}
              </div>
              {categoryGroups.length === 0 && <p className="rounded-input border border-dashed border-card-border p-5 text-center text-sm text-text-muted">Tidak ada jadwal pada status waktu ini.</p>}
            </div>
          ) : !selectedProgram ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-heading-dark">Program · {selectedCategoryLabel}</h3>
                <p className="text-sm text-text-muted">Status waktu: {selectedTimeLabel}. Pilih program untuk membuka jadwal.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {programGroups.map((item) => (
                  <DrilldownCard key={item.key} item={item} onClick={() => setSelectedProgram(item.key)} />
                ))}
              </div>
              {programGroups.length === 0 && <p className="rounded-input border border-dashed border-card-border p-5 text-center text-sm text-text-muted">Tidak ada program pada kategori ini.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-heading-dark">Paket Try Out / Jadwal · {selectedProgramLabel}</h3>
                <p className="text-sm text-text-muted">{selectedTimeLabel} · {selectedCategoryLabel} · {programSchedules.length} jadwal</p>
              </div>
              {programSchedules.map((item) => {
                const paket = paketById.get(item.paket_ujian_id);
                const category = getCategoryIdentity(paket).label;
                const programName = getProgramName(getEffectiveProgramId(item, paket));
                const className = getClassName(getEffectiveClassId(item, paket));
                const temporalStatus = getTimeStatus(item, now);
                const temporalLabel = statusCards.find((status) => status.key === temporalStatus)?.label || "Waktu Tidak Valid";
                return (
                  <article key={item.id} className="rounded-card border border-card-border bg-card-bg p-4 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-heading-dark">{paket?.nama || `Paket #${item.paket_ujian_id}`}</h4>
                          <span className="rounded-full bg-neutral px-2.5 py-1 text-xs font-semibold text-body-dark">Jadwal #{item.id}</span>
                          <span className="rounded-full border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-1 text-xs font-semibold text-brand-primary">{temporalLabel}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_published ? "border border-green-200 bg-green-50 text-green-700" : "bg-neutral text-body-dark"}`}>
                            {item.is_published ? "Aktif" : "Tersimpan"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-text-muted">
                          {new Date(item.mulai).toLocaleString("id-ID")} - {new Date(item.selesai).toLocaleString("id-ID")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[category, programName, className].map((label) => (
                            <span key={label} className="rounded-full border border-card-border bg-neutral/60 px-2.5 py-1 text-xs font-medium text-body-dark">{label}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button
                          type="button"
                          onClick={() => void togglePublish(item)}
                          disabled={busyId === item.id}
                          className={item.is_published ? outlineButtonClass : primaryButtonClass}
                        >
                          {item.is_published ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button type="button" onClick={() => startEdit(item)} disabled={busyId === item.id} className={outlineButtonClass}>Edit</button>
                        <button
                          type="button"
                          onClick={() => void deleteJadwal(item)}
                          disabled={busyId === item.id}
                          className="rounded-btn bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {programSchedules.length === 0 && <p className="rounded-input border border-dashed border-card-border p-5 text-center text-sm text-text-muted">Tidak ada jadwal pada program ini.</p>}
            </div>
          )}
        </section>
      </section>
      {dialog}
    </main>
  );
}
