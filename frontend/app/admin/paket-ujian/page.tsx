"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
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
import MathContent from "@/components/MathContent";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  BagianPaket,
  KategoriPaket,
  Kelas,
  PaketUjian,
  Pelajaran,
  Program,
  Soal,
  Topik,
} from "@/lib/types";
import { labelTipeSoal } from "@/lib/tipe-soal";

type TipePaket = "ujian" | "latihan";
type GuruScope = {
  pelajaran_id: number;
  program_id?: number | null;
  kelas_id?: number | null;
};
type GrupTryout = { id: number; nama: string; is_active: boolean };
type KategoriKey = number | "belum";

const tipeCards = [
  {
    value: "ujian" as const,
    label: "Tryout",
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
  const [grupList, setGrupList] = useState<GrupTryout[]>([]);
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
  });
  const [bagianSaving, setBagianSaving] = useState(false);
  const [bagianPicker, setBagianPicker] = useState<BagianPaket | null>(null);
  const [bagianQuestions, setBagianQuestions] = useState<Soal[]>([]);
  const [assignmentTarget, setAssignmentTarget] = useState<PaketUjian | null>(
    null,
  );
  const [teachers, setTeachers] = useState<{ id: number; username: string }[]>(
    [],
  );
  const [assigned, setAssigned] = useState<number[]>([]);
  const [assignmentError, setAssignmentError] = useState("");
  const [scheduleTarget, setScheduleTarget] = useState<PaketUjian | null>(null);
  const [scheduleMulai, setScheduleMulai] = useState("");
  const [scheduleGrup, setScheduleGrup] = useState("");
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
        grupRes,
         programRes,
         scopeRes,
         kategoriRes,
       ] = await Promise.all([

        api.get("/paket-ujian/"),
        api.get("/pelajaran/"),
        api.get("/kelas/"),
        api.get("/topik/"),
        api.get("/grup-tryout/", { params: { is_active: true } }),
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
      setGrupList(grupRes.data);
      setProgramList(programRes.data);
      setKategoriList(kategoriRes.data);
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
    [paket, activeTipe],
  );

  const loadBagian = async (paketId: number) => {
    setBagianLoading(true);
    try {
      const { data } = await api.get(`/paket-ujian/${paketId}/bagian`);
      setBagianList(data ?? []);
    } catch {
      setBagianList([]);
    } finally {
      setBagianLoading(false);
    }
  };
  const openPaket = async (item: PaketUjian) => {
    setActivePaket(item);
    setBagianFormOpen(false);
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
    });
    setBagianFormOpen(true);
  };
  const selectedPelajaran = pelajaranList.find(
    (p) => p.id === Number(bagianForm.pelajaran_id),
  );
  const availablePelajaran = pelajaranList.filter((p) => {
    if (!p.is_active) return false;
    return !bagianList.some(
      (b) => b.id !== bagianEditingId && b.pelajaran_id === p.id,
    );
  });
  const submitBagian = async (event: FormEvent) => {
    event.preventDefault();
    if (!activePaket || !bagianForm.pelajaran_id) return;
    setBagianSaving(true);
    try {
      const payload = {
        nama: bagianForm.nama.trim() || selectedPelajaran?.nama || "",
        urutan: 0,
        pelajaran_id: Number(bagianForm.pelajaran_id),
        deskripsi: bagianForm.deskripsi || null,
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
  const deleteBagian = async (bagian: BagianPaket) => {
    if (
      !activePaket ||
      !(await showConfirm({
        title: "Hapus Bagian Paket",
        description: `Bagian \"${bagian.nama}\" beserta soal di dalamnya akan dihapus.`,
        confirmLabel: "Hapus Bagian",
        confirmVariant: "danger",
      }))
    )
      return;
    try {
      await api.delete(`/paket-ujian/${activePaket.id}/bagian/${bagian.id}`);
      await refreshPaketDetail();
    } catch (error) {
      await showAlert({
        title: "Gagal Menghapus Bagian",
        description: getErrorMessage(error, "Bagian gagal dihapus."),
      });
    }
  };

  const updateBagianDuration = async (bagian: BagianPaket) => {
    if (!activePaket) return;
    const value = await showPrompt({
      title: `Atur Durasi — ${bagian.nama}`,
      description: "Isi durasi bagian dalam menit (1-1440).",
      inputLabel: "Menit",
      required: true,
    });
    if (value === null) return;
    try {
      await api.patch(
        `/paket-ujian/${activePaket.id}/bagian/${bagian.id}/durasi`,
        { durasi_menit: Number(value) },
      );
      await refreshPaketDetail();
    } catch (error) {
      await showAlert({
        title: "Durasi gagal disimpan",
        description: getErrorMessage(
          error,
          "Durasi harus 1 sampai 1440 menit.",
        ),
      });
    }
  };

  const openBagianPicker = async (bagian: BagianPaket) => {
    if (isGuru) {
      const kategoriId = activePaket?.kategori_id == null ? "belum" : String(activePaket.kategori_id);
      router.push(`/guru/paket-ujian/isi-soal?id=${activePaket?.id}&bagian_id=${bagian.id}&tipe=${activeTipe ?? "ujian"}&kategori_id=${encodeURIComponent(kategoriId)}`);
      return;
    }
    const assignedIds = bagian.soal_ids ?? [];
    setBagianPicker(bagian);
    setBagianQuestions([]);
    try {
      const details = await Promise.all(
        assignedIds.map((soalId) => api.get(`/soal/${soalId}`)),
      );
      setBagianQuestions(details.map(({ data }) => data));
    } catch {
      setBagianQuestions([]);
    }
  };

  const handleArchive = async (item: PaketUjian) => {
    if (
      !(await showConfirm({
        title: "Arsipkan Paket",
        description:
          "Paket tidak muncul untuk jadwal baru, tetapi data lama tetap tersimpan.",
        confirmLabel: "Arsipkan",
        confirmVariant: "danger",
      }))
    )
      return;
    try {
      await api.post(`/paket-ujian/${item.id}/archive`);
      setActivePaket(null);
      await loadAll();
    } catch (error) {
      await showAlert({
        title: "Gagal Mengarsipkan",
        description: getErrorMessage(error, "Paket gagal diarsipkan."),
      });
    }
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
  const openAssignment = async (item: PaketUjian) => {
    setAssignmentTarget(item);
    setAssigned(item.assigned_guru_ids ?? []);
    setAssignmentError("");
    try {
      const { data } = await api.get("/users/");
      setTeachers(data.filter((u: { role: string }) => u.role === "guru"));
    } catch (error) {
      setAssignmentError(getErrorMessage(error, "Guru gagal dimuat."));
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
        title: "Tryout belum siap",
        description:
          "Tambahkan minimal satu mata pelajaran/bagian sebelum menjadwalkan Tryout.",
      });
      return;
    }
    const invalidDuration = sections.filter(
      (b) => !b.durasi_menit || b.durasi_menit < 1 || b.durasi_menit > 1440,
    );
    if (invalidDuration.length) {
      await showAlert({
        title: "Tryout belum siap",
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
        title: "Tryout belum siap",
        description: `Isi soal pada setiap bagian terlebih dahulu${empty.length ? `: ${empty.map((b) => b.nama).join(", ")}` : ""}.`,
      });
      return;
    }
    setScheduleTarget(item);
    setScheduleMulai("");
    setScheduleGrup("");
    setScheduleError("");
    setScheduleSuccess("");
  };
  const submitSchedule = async () => {
    if (!scheduleTarget || !scheduleMulai) {
      setScheduleError("Pilih tanggal dan jam mulai ujian terlebih dahulu.");
      return;
    }
    setScheduleSaving(true);
    setScheduleError("");
    try {
      const mulai = new Date(scheduleMulai);
      await api.post("/jadwal-ujian/", {
        paket_ujian_id: scheduleTarget.id,
        mulai: mulai.toISOString(),
        selesai: new Date(
          mulai.getTime() + scheduleTarget.durasi_menit * 60000,
        ).toISOString(),
        is_published: !isGuru,
        grup_tryout_id: scheduleGrup ? Number(scheduleGrup) : null,
      });
      setScheduleSuccess(
        isGuru
          ? "Draft jadwal berhasil dibuat."
          : "Tryout berhasil dijadwalkan dan diaktifkan.",
      );
    } catch (error) {
      setScheduleError(getErrorMessage(error, "Gagal membuat jadwal."));
    } finally {
      setScheduleSaving(false);
    }
  };
  const crumbs = [
    "Ujian",
    activeTipe
      ? tipeCards.find((item) => item.value === activeTipe)?.label
      : null,
    activeKategori ? kategoriCards.find((item) => item.value === activeKategori)?.label : null,
    activePaket?.nama,
  ].filter(Boolean);

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
            ? "Buka paket yang ditugaskan, atur durasi, lalu isi soal setiap mata pelajaran."
            : "Admin menentukan mata pelajaran dan menugaskan guru; guru mengatur durasi dan mengisi soal."}
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        {crumbs.map((crumb, index) => (
          <span
            key={`${crumb}-${index}`}
            className="inline-flex items-center gap-2"
          >
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <span
              className={
                index === crumbs.length - 1
                  ? "font-semibold text-heading-dark"
                  : ""
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {assignmentTarget && (
        <Card title={`Penugasan: ${assignmentTarget.nama}`}>
          {assignmentError && (
            <p className="mb-3 text-red-600">{assignmentError}</p>
          )}
          <p className="mb-3 text-sm">
            Pilih guru yang dapat mengisi paket ini.
          </p>
          {teachers.map((teacher) => (
            <label key={teacher.id} className="mb-2 flex gap-2">
              <input
                type="checkbox"
                checked={assigned.includes(teacher.id)}
                onChange={(e) =>
                  setAssigned(
                    e.target.checked
                      ? [...assigned, teacher.id]
                      : assigned.filter((id) => id !== teacher.id),
                  )
                }
              />
              {teacher.username}
            </label>
          ))}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await api.put(
                    `/paket-ujian/${assignmentTarget.id}/penugasan`,
                    assigned,
                  );
                  setAssignmentTarget(null);
                  await loadAll();
                } catch (error) {
                  setAssignmentError(
                    getErrorMessage(error, "Penugasan gagal."),
                  );
                }
              }}
            >
              Simpan
            </Button>
            <Button variant="outline" onClick={() => setAssignmentTarget(null)}>
              Batal
            </Button>
          </div>
        </Card>
      )}

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
                Buat {activeTipe === "latihan" ? "Latihan" : "Tryout"}
              </Button>
            )}
          </div>
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari paket..."
              className="w-full rounded-input border border-card-border py-2.5 pl-9 pr-3 text-sm"
            />
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignment(activePaket)}
                  >
                    Tugaskan Guru
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
                    variant="outline"
                    onClick={() => handleArchive(activePaket)}
                  >
                    <Archive className="mr-1 h-4 w-4" /> Arsipkan
                  </Button>
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-heading-dark">
                Mata Pelajaran / Bagian
              </h3>
              <p className="text-sm text-text-muted">
                {isGuru
                  ? "Atur durasi dan isi soal setiap bagian mapel dalam lingkup Anda."
                  : "Tentukan mapel dan tugaskan guru. Guru akan mengatur durasi serta mengisi soal."}
              </p>
            </div>
            {!isGuru && !bagianFormOpen && (
              <Button size="sm" onClick={() => openBagianForm()}>
                + Tambah Mapel
              </Button>
            )}
          </div>
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
                    const p = pelajaranList.find(
                      (item) => item.id === Number(e.target.value),
                    );
                    setBagianForm((current) => ({
                      ...current,
                      pelajaran_id: e.target.value,
                      nama: current.nama || p?.nama || "",
                    }));
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
                  label="Nama Bagian"
                  value={bagianForm.nama}
                  onChange={(e) =>
                    setBagianForm({ ...bagianForm, nama: e.target.value })
                  }
                  placeholder="Otomatis mengikuti nama mapel"
                />
              </div>
              <Textarea
                label="Deskripsi (opsional)"
                value={bagianForm.deskripsi}
                onChange={(e) =>
                  setBagianForm({ ...bagianForm, deskripsi: e.target.value })
                }
              />
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
          ) : bagianList.length === 0 ? (
            <p className="rounded-input border border-dashed border-card-border p-8 text-center text-sm text-text-muted">
              Belum ada mata pelajaran. Tambahkan bagian agar paket dapat diisi
              dan dijadwalkan.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bagianList.map((bagian) => (
                <article
                  key={bagian.id}
                  className="rounded-card border border-card-border p-4"
                >
                  <h4 className="font-bold text-heading-dark">{bagian.nama}</h4>
                  <p className="mt-1 text-sm text-text-muted">
                    {getNama(pelajaranList, bagian.pelajaran_id)}
                  </p>
                  <p className="mt-2 text-sm">
                    {bagian.durasi_menit
                      ? `${bagian.durasi_menit} menit`
                      : "Durasi menunggu guru"}{" "}
                    · {bagian.jumlah_soal} soal
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openBagianPicker(bagian)}>
                      {isGuru ? "Isi Soal" : "Lihat Soal"}
                    </Button>
                    {isGuru && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateBagianDuration(bagian)}
                      >
                        Atur Durasi
                      </Button>
                    )}
                    {!isGuru && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openBagianForm(bagian)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteBagian(bagian)}
                        >
                          Hapus
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      )}

      {scheduleTarget && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4">
          <div className="my-6 w-full max-w-md rounded-modal bg-card-bg shadow-modal">
            <div className="border-b border-card-border p-5">
              <h2 className="text-lg font-bold">Jadwalkan Tryout</h2>
              <p className="text-sm text-text-muted">{scheduleTarget.nama}</p>
            </div>
            <div className="space-y-4 p-5">
              <Input
                label="Mulai Ujian"
                type="datetime-local"
                required
                value={scheduleMulai}
                onChange={(e) => setScheduleMulai(e.target.value)}
              />
              <Select
                label="Gelombang (opsional)"
                value={scheduleGrup}
                onChange={(e) => setScheduleGrup(e.target.value)}
                options={[
                  { value: "", label: "Tanpa gelombang" },
                  ...grupList.map((g) => ({ value: g.id, label: g.nama })),
                ]}
              />
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

      {bagianPicker && activePaket && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-heading-dark/50 p-4">
          <div className="my-6 w-full max-w-2xl rounded-modal bg-card-bg shadow-modal">
            <div className="border-b border-card-border p-5">
              <h2 className="text-lg font-bold">Lihat Soal — {bagianPicker.nama}</h2>
              <p className="text-sm text-text-muted">
                Soal {getNama(pelajaranList, bagianPicker.pelajaran_id)} yang telah ditambahkan guru.
              </p>
            </div>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto p-5">
              {bagianQuestions.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  Guru belum menambahkan soal pada bagian ini.
                </p>
              ) : (
                bagianQuestions.map((soal, index) => (
                  <article
                    key={soal.id}
                    className="rounded-input border border-card-border p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="font-semibold text-heading-dark">
                        Soal {index + 1}
                      </span>
                      <span>#{soal.id}</span>
                      <span>{labelTipeSoal(soal.tipe)}</span>
                      <span>{getNama(topikList, soal.topik_id)}</span>
                      {soal.subbab && <span>{soal.subbab}</span>}
                      {soal.tingkat_kesulitan && (
                        <span>Kesulitan {soal.tingkat_kesulitan}</span>
                      )}
                    </div>
                    <MathContent
                      className="prose prose-sm max-w-none"
                      html={soal.teks_soal}
                    />
                    {soal.opsi_jawaban && soal.opsi_jawaban.length > 0 && (
                      <ol className="mt-3 space-y-1 pl-5 text-sm text-body-dark">
                        {soal.opsi_jawaban.map((opsi) => (
                          <li key={opsi.id} className="list-[upper-alpha]">
                            <MathContent html={opsi.teks_opsi} />
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="border-t border-card-border p-5">
              <Button variant="outline" onClick={() => setBagianPicker(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
