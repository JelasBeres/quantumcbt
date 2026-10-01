"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Search,
} from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import BagianSetCards from "@/components/BagianSetCards";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import ResetFilterButton from "@/components/ResetFilterButton";
import {
  BagianPaket,
  KategoriPaket,
  Kelas,
  PaketMapel,
  PaketUjian,
  Pelajaran,
  Program,
  Topik,
} from "@/lib/types";

type TipePaket = "ujian" | "latihan";
type GuruScope = {
  pelajaran_id: number;
  program_id?: number | null;
  kelas_id?: number | null;
};
type KategoriKey = number | "belum";

const tipeCards = [
  {
    value: "ujian" as const,
    label: "Try Out",
    subtitle: "Paket dengan jadwal",
    icon: ClipboardList,
  },
  {
    value: "latihan" as const,
    label: "Latihan",
    subtitle: "Tersedia tanpa jadwal",
    icon: BookOpen,
  },
];

export default function PaketUjianPage() {
  const isGuru = getUser()?.role === "guru";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert, showConfirm, showPrompt, dialog } = useAppDialog();
  const initialTipe = searchParams.get("tipe");
  const initialKategoriParam = searchParams.get("kategori_id") ?? searchParams.get("kategori");
  const [activeTipe, setActiveTipe] = useState<TipePaket | null>(
    initialTipe === "ujian" || initialTipe === "latihan" ? initialTipe : null,
  );
  const [activeKategori, setActiveKategori] = useState<KategoriKey | null>(
    initialKategoriParam === "belum" ? "belum" : initialKategoriParam && /^\d+$/.test(initialKategoriParam) ? Number(initialKategoriParam) : null,
  );
  const [activePaket, setActivePaket] = useState<PaketUjian | null>(null);
  const [paket, setPaket] = useState<PaketUjian[]>([]);
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [programList, setProgramList] = useState<Program[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriPaket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bagianList, setBagianList] = useState<BagianPaket[]>([]);
  const [bagianLoading, setBagianLoading] = useState(false);
  const [bagianFormOpen, setBagianFormOpen] = useState(false);
  const [bagianEditingId, setBagianEditingId] = useState<number | null>(null);
  const [bagianForm, setBagianForm] = useState({
    nama: "",
    pelajaran_id: "",
    deskripsi: "",
    wajib: true,
  });
  const [bagianSaving, setBagianSaving] = useState(false);
  // Paket latihan: Mapel -> Set soal -> Soal. Set dikelola di halaman set-soal.
  const [mapelList, setMapelList] = useState<PaketMapel[]>([]);
  const [mapelFormOpen, setMapelFormOpen] = useState(false);
  const [mapelPelajaranId, setMapelPelajaranId] = useState("");
  const [mapelSaving, setMapelSaving] = useState(false);
  const initialPaketId = Number(searchParams.get("paket_id")) || null;
  const paketRestored = useRef(false);
  const basePath = isGuru ? "/guru" : "/admin";
  const [scheduleTarget, setScheduleTarget] = useState<PaketUjian | null>(null);
  const [scheduleMulai, setScheduleMulai] = useState("");
  const [scheduleSelesai, setScheduleSelesai] = useState("");
  const [scheduleSelesaiManual, setScheduleSelesaiManual] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  const loadAll = async () => {
    try {
      const scopeRequest = isGuru
        ? api.get("/guru-scope/me")
        : Promise.resolve({ data: [] });
      const [
        paketRes,
        pelajaranRes,
        kelasRes,
        topikRes,
         programRes,
         scopeRes,
         kategoriRes,
       ] = await Promise.all([

        api.get("/paket-ujian/"),
        api.get("/pelajaran/"),
        api.get("/kelas/"),
        api.get("/topik/"),
         api.get("/program/"),
         scopeRequest,
         api.get("/kategori-paket/"),
       ]);

      const scopes = scopeRes.data as GuruScope[];
      setPaket(paketRes.data);
      setPelajaranList(
        isGuru
          ? pelajaranRes.data.filter((p: Pelajaran) =>
              scopes.some((scope) => scope.pelajaran_id === p.id),
            )
          : pelajaranRes.data,
      );
      setKelasList(kelasRes.data);
      setTopikList(topikRes.data);
      setProgramList(programRes.data);
      setKategoriList(kategoriRes.data);
      if (initialPaketId && !paketRestored.current) {
        paketRestored.current = true;
        const found = (paketRes.data as PaketUjian[]).find((item) => item.id === initialPaketId);
        if (found) await openPaket(found);
      }
    } catch (error) {
      await showAlert({
        title: "Data gagal dimuat",
        description: getErrorMessage(error, "Gagal memuat paket ujian."),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const getNama = <T extends { id: number; nama: string }>(
    list: T[],
    id?: number | null,
  ) => (id ? (list.find((item) => item.id === id)?.nama ?? "-") : "-");
  const kategoriCards = useMemo(
    () => [
      ...kategoriList
        .filter((item) => item.is_active && activeTipe && (item.tipe === "keduanya" || item.tipe === activeTipe))
        .map((item) => ({ value: item.id as KategoriKey, label: item.nama, kode: item.kode })),
      { value: "belum" as KategoriKey, label: "Belum Dikategorikan", kode: "belum" },
    ],
    [kategoriList, activeTipe],
  );
  const kategoriLabel = (item?: PaketUjian | null) =>
    item?.kategori_nama ?? kategoriList.find((kategori) => kategori.id === item?.kategori_id)?.nama ?? item?.kategori?.toUpperCase().replaceAll("_", " ") ?? "Belum Dikategorikan";
  const filteredPaket = useMemo(
    () =>
      paket.filter((item) => {
        if (activeTipe && (item.tipe ?? "ujian") !== activeTipe) return false;
        if (activeKategori && (item.kategori_id ?? "belum") !== activeKategori)
          return false;
        return (
          !query.trim() ||
          `${item.nama} ${item.deskripsi ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        );
      }),
    [paket, activeTipe, activeKategori, query],
  );
  const tipeCounts = useMemo(
    () => ({
      ujian: paket.filter((p) => (p.tipe ?? "ujian") === "ujian").length,
      latihan: paket.filter((p) => p.tipe === "latihan").length,
    }),
    [paket],
  );
  const kategoriCounts = useMemo(
    () =>
      Object.fromEntries(
        kategoriCards.map((item) => [
          item.value,
          paket.filter(
            (p) =>
              (p.tipe ?? "ujian") === activeTipe &&
              (p.kategori_id ?? "belum") === item.value,
          ).length,
        ]),
      ),
    [kategoriCards, paket, activeTipe],
  );

  const loadBagian = async (paketId: number) => {
    setBagianLoading(true);
    try {
      const [bagianRes, mapelRes] = await Promise.all([
        api.get(`/paket-ujian/${paketId}/bagian`),
        api.get(`/paket-ujian/${paketId}/mapel`),
      ]);
      setBagianList(bagianRes.data ?? []);
      setMapelList(mapelRes.data ?? []);
    } catch {
      setBagianList([]);
      setMapelList([]);
    } finally {
      setBagianLoading(false);
    }
  };
  const openPaket = async (item: PaketUjian) => {
    setActivePaket(item);
    setBagianFormOpen(false);
    setMapelFormOpen(false);
    await loadBagian(item.id);
  };
  const refreshPaketDetail = async () => {
    await loadAll();
    if (activePaket) {
      const { data } = await api.get(`/paket-ujian/${activePaket.id}`);
      setActivePaket(data);
      await loadBagian(activePaket.id);
    }
  };

  const openBagianForm = (bagian?: BagianPaket) => {
    setBagianEditingId(bagian?.id ?? null);
    setBagianForm({
      nama: bagian?.nama ?? "",
      pelajaran_id: bagian?.pelajaran_id ? String(bagian.pelajaran_id) : "",
      deskripsi: bagian?.deskripsi ?? "",
      wajib: bagian?.wajib !== false,
    });
    setBagianFormOpen(true);
  };
  // Satu mapel boleh punya beberapa set soal (bagian): Matematika 1, Matematika 2, ...
  const availablePelajaran = pelajaranList.filter(
    (p) => p.is_active || p.id === Number(bagianForm.pelajaran_id),
  );
  const namaSetOtomatis = (pelajaranId: number) => {
    const p = pelajaranList.find((item) => item.id === pelajaranId);
    if (!p) return "";
    const urutan = bagianList.filter(
      (b) => b.id !== bagianEditingId && b.pelajaran_id === pelajaranId,
    ).length + 1;
    return `${p.nama} ${urutan}`;
  };
  const submitBagian = async (event: FormEvent) => {
    event.preventDefault();
    if (!activePaket || !bagianForm.pelajaran_id) return;
    setBagianSaving(true);
    try {
      const payload = {
        nama: bagianForm.nama.trim() || namaSetOtomatis(Number(bagianForm.pelajaran_id)),
        urutan: 0,
        pelajaran_id: Number(bagianForm.pelajaran_id),
        deskripsi: bagianForm.deskripsi || null,
        wajib: bagianForm.wajib,
      };
      if (bagianEditingId)
        await api.put(
          `/paket-ujian/${activePaket.id}/bagian/${bagianEditingId}`,
          payload,
        );
      else await api.post(`/paket-ujian/${activePaket.id}/bagian`, payload);
      setBagianFormOpen(false);
      await refreshPaketDetail();
    } catch (error) {
      await showAlert({
        title: "Gagal Menyimpan Bagian",
        description: getErrorMessage(
          error,
          "Periksa mata pelajaran dan program paket.",
        ),
      });
    } finally {
      setBagianSaving(false);
    }
  };
  const submitMapel = async (event: FormEvent) => {
    event.preventDefault();
    if (!activePaket || !mapelPelajaranId) return;
    setMapelSaving(true);
    try {
      await api.post(`/paket-ujian/${activePaket.id}/mapel`, { pelajaran_id: Number(mapelPelajaranId) });
      setMapelFormOpen(false);
      setMapelPelajaranId("");
      await refreshPaketDetail();
    } catch (error) {
      await showAlert({
        title: "Gagal Menambah Mapel",
        description: getErrorMessage(error, "Mapel gagal ditambahkan."),
      });
    } finally {
      setMapelSaving(false);
    }
  };
  const deleteMapel = async (mapel: PaketMapel) => {
    if (
      !activePaket ||
      !(await showConfirm({
        title: "Hapus Mapel",
        description: `Mapel "${mapel.nama}" beserta ${mapel.jumlah_set} set soal di dalamnya akan dihapus dari paket.`,
        confirmLabel: "Hapus Mapel",
        confirmVariant: "danger",
      }))
    )
      return;
    try {
      await api.delete(`/paket-ujian/${activePaket.id}/mapel/${mapel.pelajaran_id}`);
      await refreshPaketDetail();
    } catch (error) {
      await showAlert({
        title: "Gagal Menghapus Mapel",
        description: getErrorMessage(error, "Mapel gagal dihapus."),
      });
    }
  };
  const openSetSoal = (mapel: PaketMapel) => {
    if (!activePaket) return;
    router.push(`${basePath}/paket-ujian/set-soal?id=${activePaket.id}&pelajaran_id=${mapel.pelajaran_id}`);
  };

  const handleDelete = async (item: PaketUjian) => {
    if (
      !(await showConfirm({
        title: "Hapus Paket",
        description:
          "Paket dan data terkait yang belum digunakan akan dihapus.",
        confirmLabel: "Hapus",
        confirmVariant: "danger",
      }))
    )
      return;
    try {
      await api.delete(`/paket-ujian/${item.id}`);
      setActivePaket(null);
      await loadAll();
    } catch (error) {
      await showAlert({
        title: "Gagal Menghapus",
        description: getErrorMessage(error, "Paket gagal dihapus."),
      });
    }
  };
  const openSchedule = async (item: PaketUjian) => {
    let sections = activePaket?.id === item.id ? bagianList : [];
    if (!sections.length) {
      try {
        sections = (await api.get(`/paket-ujian/${item.id}/bagian`)).data ?? [];
      } catch {
        sections = [];
      }
    }
    if (!sections.length) {
      await showAlert({
        title: "Try Out belum siap",
        description:
          "Tambahkan minimal satu mata pelajaran/bagian sebelum menjadwalkan Try Out.",
      });
      return;
    }
    const invalidDuration = sections.filter(
      (b) => !b.durasi_menit || b.durasi_menit < 1 || b.durasi_menit > 1440,
    );
    if (invalidDuration.length) {
      await showAlert({
        title: "Try Out belum siap",
        description: `Isi durasi 1-1440 menit pada setiap bagian: ${invalidDuration.map((b) => b.nama).join(", ")}.`,
      });
      return;
    }
    const empty = sections.filter((b) => b.jumlah_soal === 0);
    if (
      empty.length ||
      sections.reduce((sum, b) => sum + b.jumlah_soal, 0) === 0
    ) {
      await showAlert({
        title: "Try Out belum siap",
        description: `Isi soal pada setiap bagian terlebih dahulu${empty.length ? `: ${empty.map((b) => b.nama).join(", ")}` : ""}.`,
      });
      return;
    }
    const notApproved = sections.filter((b) => b.status !== "approved");
    if (notApproved.length) {
      await showAlert({
        title: "Try Out belum siap",
        description: `Semua bagian harus disetujui admin terlebih dahulu: ${notApproved.map((b) => b.nama).join(", ")}.`,
      });
      return;
    }
    setScheduleTarget(item);
    setScheduleMulai("");
    setScheduleSelesai("");
    setScheduleSelesaiManual(false);
    setScheduleError("");
    setScheduleSuccess("");
  };
  const submitSchedule = async () => {
    if (!scheduleTarget || !scheduleMulai) {
      setScheduleError("Pilih tanggal dan jam mulai ujian terlebih dahulu.");
      return;
    }
    if (!scheduleSelesai) {
      setScheduleError("Pilih tanggal dan jam tutup ujian terlebih dahulu.");
      return;
    }
    const mulai = new Date(scheduleMulai);
    const selesai = new Date(scheduleSelesai);
    if (selesai.getTime() - mulai.getTime() < scheduleTarget.durasi_menit * 60000) {
      setScheduleError(`Waktu tutup minimal ${scheduleTarget.durasi_menit} menit (durasi ujian) setelah waktu mulai.`);
      return;
    }
    setScheduleSaving(true);
    setScheduleError("");
    try {
      await api.post("/jadwal-ujian/", {
        paket_ujian_id: scheduleTarget.id,
        mulai: mulai.toISOString(),
        selesai: selesai.toISOString(),
        is_published: !isGuru,
      });
      setScheduleSuccess(
        isGuru
          ? "Draft jadwal berhasil dibuat."
          : "Try Out berhasil dijadwalkan dan diaktifkan.",
      );
    } catch (error) {
      setScheduleError(getErrorMessage(error, "Gagal membuat jadwal."));
    } finally {
      setScheduleSaving(false);
    }
  };
  // Breadcrumb bisa diklik: tiap level kembali ke tampilan level tersebut.
  const crumbs: Array<{ label: string; onClick: () => void }> = [
    { label: "Ujian", onClick: () => { setActiveTipe(null); setActiveKategori(null); setActivePaket(null); } },
    ...(activeTipe ? [{ label: tipeCards.find((item) => item.value === activeTipe)?.label ?? activeTipe, onClick: () => { setActiveKategori(null); setActivePaket(null); } }] : []),
    ...(activeKategori ? [{ label: kategoriCards.find((item) => item.value === activeKategori)?.label ?? "Kategori", onClick: () => setActivePaket(null) }] : []),
    ...(activePaket ? [{ label: activePaket.nama, onClick: () => undefined }] : []),
  ];

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        Memuat data...
      </div>
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-heading-dark">Ujian</h1>
        <p className="mt-1 text-sm text-text-muted">
          {isGuru
            ? "Buka paket sesuai mapel yang Anda ampu, atur durasi, lalu isi soal bagian tersebut."
            : "Admin menentukan bagian mapel. Bagian otomatis tersedia bagi guru pengampu mapel yang sesuai program dan kelas."}
        </p>
      </header>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="font-semibold text-heading-dark">{crumb.label}</span>
            ) : (
              <button type="button" onClick={crumb.onClick} className="rounded px-1 font-semibold text-brand-primary hover:bg-brand-primary/10 hover:underline">
                {crumb.label}
              </button>
            )}
          </span>
        ))}
      </nav>

      {!activeTipe && (
        <Card title="Pilih Jenis">
          <div className="grid gap-4 sm:grid-cols-2">
            {tipeCards.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => {
                    setActiveTipe(item.value);
                    setActiveKategori(null);
                    setActivePaket(null);
                  }}
                  className="group rounded-card border border-card-border p-5 text-left transition hover:border-brand-primary hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-neutral px-3 py-1 text-xs font-bold">
                      {tipeCounts[item.value]} paket
                    </span>
                  </div>
                  <h2 className="mt-5 font-bold text-heading-dark">
                    {item.label}
                  </h2>
                  <p className="text-sm text-text-muted">{item.subtitle}</p>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {activeTipe && !activeKategori && (
        <Card>
          <button
            onClick={() => setActiveTipe(null)}
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Jenis
          </button>
          <h2 className="mb-4 text-lg font-bold text-heading-dark">
            Pilih Kategori{" "}
            {tipeCards.find((item) => item.value === activeTipe)?.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kategoriCards.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setActiveKategori(item.value);
                  setActivePaket(null);
                }}
                className="rounded-card border border-card-border p-5 text-left transition hover:border-brand-primary hover:shadow-card-hover"
              >
                <span className="rounded-full bg-neutral px-3 py-1 text-xs font-bold">
                  {kategoriCounts[item.value] ?? 0} paket
                </span>
                <h3 className="mt-5 font-bold text-heading-dark">
                  {item.label}
                </h3>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary">
                  Lihat paket <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {activeTipe && activeKategori && !activePaket && (
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-4">
            <button
              onClick={() => setActiveKategori(null)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke Kategori
            </button>
            {!isGuru && activeKategori !== "belum" && (
              <Button
                onClick={() =>
                  router.push(
                     `/admin/paket-ujian/tambah?tipe=${activeTipe}&kategori_id=${activeKategori}`,

                  )
                }
              >
                Buat {activeTipe === "latihan" ? "Latihan" : "Paket"}
              </Button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari paket..."
                className="w-full rounded-input border border-card-border py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <ResetFilterButton active={Boolean(query)} onReset={() => setQuery("")} />
          </div>
          {filteredPaket.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Belum ada paket pada kategori ini.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPaket.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openPaket(item)}
                  className="rounded-card border border-card-border p-5 text-left transition hover:border-brand-primary hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-heading-dark">{item.nama}</h3>
                    <ChevronRight className="h-4 w-4 text-brand-primary" />
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    {getNama(programList, item.program_id)} · Total durasi{" "}
                    {item.durasi_menit} menit
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {item.jumlah_bagian ?? 0} bagian · {item.jumlah_soal} soal
                  </p>
                  <span className="mt-3 mr-2 inline-block rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                    {item.metode_penilaian === "kohort" ? `Benchmark Kohort · ${(item.skala_kohort ?? "utbk").toUpperCase()}` : "Nilai Biasa"}
                  </span>
                  <span
                    className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${item.siap_dipublikasikan ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {item.siap_dipublikasikan ? "Siap" : "Belum siap"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {activePaket && (
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-card-border pb-4">
            <div>
              <button
                onClick={() => setActivePaket(null)}
                className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali ke Paket
              </button>
              <h2 className="text-xl font-bold text-heading-dark">
                {activePaket.nama}
              </h2>
              <p className="text-sm text-text-muted">
                 {kategoriLabel(activePaket)} ·{" "}

                 {getNama(programList, activePaket.program_id)} · Total durasi{" "}
                 {activePaket.durasi_menit} menit · {activePaket.metode_penilaian === "kohort" ? `Benchmark Kohort (${(activePaket.skala_kohort ?? "utbk").toUpperCase()})` : "Nilai Biasa"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isGuru && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(
                        `/admin/paket-ujian/tambah?id=${activePaket.id}&tipe=${activeTipe}&kategori_id=${activePaket.kategori_id ?? ""}`,
                      )
                    }
                  >
                    Edit Paket
                  </Button>
                  {activePaket.tipe === "ujian" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSchedule(activePaket)}
                    >
                      <CalendarClock className="mr-1 h-4 w-4" /> Jadwalkan
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(activePaket)}
                  >
                    Hapus
                  </Button>
                </>
              )}
            </div>
          </div>
          {activePaket.tipe === "latihan" ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-heading-dark">Mata Pelajaran</h3>
                  <p className="text-sm text-text-muted">
                    {isGuru
                      ? "Buka mapel yang Anda ampu untuk mengisi soal setiap set."
                      : "Tambah mapel, lalu buka mapel untuk menambah set soal (Matematika 1, Matematika 2, ...)."}
                  </p>
                </div>
                {!isGuru && !mapelFormOpen && (
                  <Button size="sm" onClick={() => { setMapelPelajaranId(""); setMapelFormOpen(true); }}>
                    + Tambah Mapel
                  </Button>
                )}
              </div>
              {mapelFormOpen && (
                <form
                  onSubmit={submitMapel}
                  className="mb-5 flex flex-wrap items-end gap-3 rounded-input border border-card-border bg-neutral p-4"
                >
                  <div className="min-w-[14rem] flex-1">
                    <Select
                      label="Mata Pelajaran"
                      required
                      value={mapelPelajaranId}
                      onChange={(e) => setMapelPelajaranId(e.target.value)}
                      options={[
                        { value: "", label: "- Pilih Mata Pelajaran -" },
                        ...pelajaranList
                          .filter((p) => p.is_active && !mapelList.some((m) => m.pelajaran_id === p.id))
                          .map((p) => ({ value: p.id, label: p.nama })),
                      ]}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={mapelSaving || !mapelPelajaranId}>
                      {mapelSaving ? "Menyimpan..." : "Simpan Mapel"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setMapelFormOpen(false)}>
                      Batal
                    </Button>
                  </div>
                </form>
              )}
              {bagianLoading ? (
                <p className="py-8 text-center text-sm text-text-muted">Memuat mapel...</p>
              ) : mapelList.length === 0 ? (
                <p className="rounded-input border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
                  {isGuru ? "Belum ada mapel dalam lingkup Anda di paket ini." : "Belum ada mata pelajaran. Tambahkan mapel terlebih dahulu."}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mapelList.map((mapel) => (
                    <article key={mapel.pelajaran_id} className="rounded-card border border-card-border p-4">
                      <h4 className="font-bold text-heading-dark">{mapel.nama}</h4>
                      <p className="mt-1 text-sm text-text-muted">
                        {mapel.jumlah_set} set · {mapel.jumlah_soal} soal
                      </p>
                      {mapel.jumlah_set > 0 && (
                        <p className="mt-1 text-xs text-text-muted">
                          {mapel.jumlah_set_approved} dari {mapel.jumlah_set} set disetujui
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openSetSoal(mapel)}>
                          {isGuru ? "Buka Set Soal" : "Tambah Latihan"}
                        </Button>
                        {!isGuru && (
                          <Button size="sm" variant="danger" onClick={() => deleteMapel(mapel)}>
                            Hapus
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
          <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-heading-dark">
                Mata Pelajaran / Bagian
              </h3>
              <p className="text-sm text-text-muted">
                {isGuru
                  ? "Atur durasi dan isi soal setiap bagian mapel dalam lingkup Anda."
                   : "Tentukan mapel dan bagian, lalu isi soal dan durasinya sendiri atau serahkan ke guru pengampu mapel. Bagian yang diisi admin langsung disetujui."}

              </p>
            </div>
            {!isGuru && !bagianFormOpen && (
              <Button size="sm" onClick={() => openBagianForm()}>
                + Tambah Mapel
              </Button>
            )}
          </div>
          {!isGuru && bagianList.length > 0 && (
            <p className="mb-4 text-sm text-text-muted">
              {activePaket.jumlah_bagian_approved ?? 0} dari {activePaket.jumlah_bagian ?? bagianList.length} bagian disetujui
              {!activePaket.siap_dipublikasikan && " · Paket belum siap dijadwalkan"}
            </p>
          )}
          {bagianFormOpen && (
            <form
              onSubmit={submitBagian}
              className="mb-5 space-y-3 rounded-input border border-card-border bg-neutral p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Mata Pelajaran"
                  required
                  value={bagianForm.pelajaran_id}
                  onChange={(e) => {
                    const pelajaranId = e.target.value;
                    setBagianForm((current) => {
                      const namaLama = current.pelajaran_id ? namaSetOtomatis(Number(current.pelajaran_id)) : "";
                      const namaMasihOtomatis = !current.nama || current.nama === namaLama;
                      return {
                        ...current,
                        pelajaran_id: pelajaranId,
                        nama: namaMasihOtomatis && pelajaranId ? namaSetOtomatis(Number(pelajaranId)) : current.nama,
                      };
                    });
                  }}
                  options={[
                    { value: "", label: "- Pilih Mata Pelajaran -" },
                    ...availablePelajaran.map((p) => ({
                      value: p.id,
                      label: p.nama,
                    })),
                  ]}
                />
                <Input
                  label="Nama Set Soal"
                  value={bagianForm.nama}
                  onChange={(e) =>
                    setBagianForm({ ...bagianForm, nama: e.target.value })
                  }
                  placeholder="Contoh: Matematika 1"
                />
              </div>
              <Textarea
                label="Deskripsi (opsional)"
                value={bagianForm.deskripsi}
                onChange={(e) =>
                  setBagianForm({ ...bagianForm, deskripsi: e.target.value })
                }
              />
              {activePaket.kategori?.toLowerCase().includes("tka") && (
                <Select
                  label="Jenis Mapel TKA"
                  value={bagianForm.wajib ? "wajib" : "pilihan"}
                  onChange={(e) => setBagianForm({ ...bagianForm, wajib: e.target.value === "wajib" })}
                  options={[{ value: "wajib", label: "Wajib dikerjakan" }, { value: "pilihan", label: "Mapel pilihan siswa" }]}
                />
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={bagianSaving || !bagianForm.pelajaran_id}
                >
                  {bagianSaving ? "Menyimpan..." : "Simpan Bagian"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBagianFormOpen(false)}
                >
                  Batal
                </Button>
              </div>
            </form>
          )}
          {bagianLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Memuat bagian...
            </p>
          ) : (
            <BagianSetCards
              paket={activePaket}
              bagianList={bagianList}
              pelajaranList={pelajaranList}
              topikList={topikList}
              isGuru={isGuru}
              emptyText="Belum ada mata pelajaran. Tambahkan bagian agar paket dapat diisi dan dijadwalkan."
              onChanged={refreshPaketDetail}
              onEdit={openBagianForm}
            />
          )}
          </>
          )}
        </Card>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4">
          <div className="my-6 w-full max-w-md rounded-modal bg-card-bg shadow-modal">
            <div className="flex items-start justify-between gap-3 border-b border-card-border p-5"><div><h2 className="text-lg font-bold text-heading-dark">Jadwalkan Try Out</h2><p className="mt-1 text-sm text-text-muted">{scheduleTarget.nama}</p></div><button type="button" onClick={() => { setScheduleTarget(null); setScheduleMulai(""); setScheduleSelesai(""); }} aria-label="Tutup" className="rounded-btn px-2 py-1 text-xl text-text-muted transition hover:bg-neutral hover:text-heading-dark">&times;</button></div>
            <div className="space-y-4 p-5">
              <Input
                label="Mulai Ujian"
                type="datetime-local"
                required
                value={scheduleMulai}
                onChange={(e) => {
                  const value = e.target.value;
                  setScheduleMulai(value);
                  // Tutup otomatis = mulai + durasi, selama belum diubah manual.
                  if (!scheduleSelesaiManual && value) {
                    setScheduleSelesai(tambahMenitLokal(value, scheduleTarget.durasi_menit));
                  }
                }}
              />
              <Input
                label="Tutup Ujian"
                type="datetime-local"
                required
                min={scheduleMulai || undefined}
                value={scheduleSelesai}
                onChange={(e) => {
                  setScheduleSelesai(e.target.value);
                  setScheduleSelesaiManual(true);
                }}
              />
              <p className="-mt-2 text-xs text-text-muted">
                Siswa bisa mulai mengerjakan sampai waktu tutup. Durasi pengerjaan {scheduleTarget.durasi_menit} menit.
              </p>
              {scheduleError && (
                <p className="text-sm text-red-600">{scheduleError}</p>
              )}
              {scheduleSuccess && (
                <p className="text-sm text-green-700">
                  {scheduleSuccess}{" "}
                  <Link
                    href="/admin/jadwal-ujian"
                    className="font-semibold underline"
                  >
                    Lihat jadwal
                  </Link>
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setScheduleTarget(null)}
                >
                  Batal
                </Button>
                <Button
                  disabled={scheduleSaving || Boolean(scheduleSuccess)}
                  onClick={submitSchedule}
                >
                  {scheduleSaving ? "Menyimpan..." : "Aktifkan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
}

// "2026-09-26T08:00" + menit -> format datetime-local lagi (waktu lokal).
function tambahMenitLokal(value: string, menit: number): string {
  const d = new Date(new Date(value).getTime() + menit * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
