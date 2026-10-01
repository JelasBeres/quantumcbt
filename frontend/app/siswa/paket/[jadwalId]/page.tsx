"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { ArrowLeft, CheckCircle2, Clock3, FileText, Play, BookOpen } from "lucide-react";
import SetSoalPerMapel, { durasiSingkat } from "@/components/SetSoalPerMapel";
import { formatWaktuJadwal } from "@/lib/waktu-jadwal";

type Jadwal = {
  jadwal_ujian_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  mulai: string;
  selesai: string;
  status: "mendatang" | "berlangsung" | "berakhir";
  durasi_menit?: number;
  jumlah_soal?: number;
  tipe?: "ujian" | "latihan" | string;
  bagian?: { bagian_id: number; nama: string; urutan: number; jumlah_soal?: number; pelajaran_id?: number | null; pelajaran_nama?: string | null; wajib?: boolean }[];
  pelajaran?: string | null;
  deskripsi_paket?: string | null;
  izinkan_pilih_mapel?: boolean;
  min_mapel_pilihan?: number;
  max_mapel_pilihan?: number;
};

type Riwayat = {
  ujian_siswa_id: number;
  jadwal_ujian_id?: number | null;
  is_submitted: boolean;
  skor?: number | null;
};

export default function DetailPaketPage() {
  const params = useParams<{ jadwalId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jadwalId = Number(params.jadwalId);
  const kategori = searchParams.get("kategori");
  const autoMulai = searchParams.get("mulai") === "1";
  const backHref = kategori ? `/siswa/tryout/${encodeURIComponent(kategori)}` : "/siswa/tryout";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [jadwal, setJadwal] = useState<Jadwal | null>(null);
  const [activeUjianId, setActiveUjianId] = useState<number | null>(null);
  const [selesaiUjianId, setSelesaiUjianId] = useState<number | null>(null);
  const [startingBagianId, setStartingBagianId] = useState<number | null>(null);
  const [selectedPelajaranIds, setSelectedPelajaranIds] = useState<number[]>([]);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    if (!jadwalId) {
      setLoading(false);
      setError("Jadwal tidak valid.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [jadwalRes, riwayatRes] = await Promise.all([
          api.get("/siswa/jadwal-tersedia"),
          api.get("/siswa/riwayat-ujian"),
        ]);

        const jadwalList: Jadwal[] = jadwalRes.data ?? [];
        const found = jadwalList.find((j) => j.jadwal_ujian_id === jadwalId);
        if (!found) {
          setError("Jadwal ujian tidak ditemukan.");
          return;
        }
        setJadwal(found);
        const wajibIds = Array.from(new Set((found.bagian ?? []).filter((b) => b.wajib !== false && b.pelajaran_id != null).map((b) => b.pelajaran_id as number)));
        setSelectedPelajaranIds(wajibIds);

        const riwayatList: Riwayat[] = riwayatRes.data ?? [];
        const sameJadwal = riwayatList.filter((r) => r.jadwal_ujian_id === jadwalId);
        const active = sameJadwal.find((r) => !r.is_submitted);
        if (active) setActiveUjianId(active.ujian_siswa_id);
        const selesai = sameJadwal.find((r) => r.is_submitted);
        if (selesai) setSelesaiUjianId(selesai.ujian_siswa_id);
      } catch (err) {
        if (!cancelled) { setStarting(false); setError(getErrorMessage(err, "Ujian gagal dimulai.")); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jadwalId, router]);

  const mapelPilihan = useMemo(() => {
    const grouped = new Map<number, { id: number; nama: string; wajib: boolean; jumlahSoal: number }>();
    for (const bagian of jadwal?.bagian ?? []) {
      if (bagian.pelajaran_id == null) continue;
      const current = grouped.get(bagian.pelajaran_id);
      grouped.set(bagian.pelajaran_id, {
        id: bagian.pelajaran_id,
        nama: bagian.pelajaran_nama || bagian.nama,
        wajib: current ? current.wajib || bagian.wajib !== false : bagian.wajib !== false,
        jumlahSoal: (current?.jumlahSoal ?? 0) + (bagian.jumlah_soal ?? 0),
      });
    }
    return Array.from(grouped.values());
  }, [jadwal?.bagian]);

  const jumlahMapelWajib = mapelPilihan.filter((item) => item.wajib).length;
  const memilikiMapelPilihan = mapelPilihan.some((item) => !item.wajib);
  const isTkaSelection = memilikiMapelPilihan && Boolean((jadwal?.min_mapel_pilihan ?? 0) > 0 || (jadwal?.max_mapel_pilihan ?? 0) > 0);
  const chosenOptionalCount = mapelPilihan.filter((item) => !item.wajib && selectedPelajaranIds.includes(item.id)).length;
  const selectionValid = !isTkaSelection || (chosenOptionalCount >= (jadwal?.min_mapel_pilihan ?? 0) && chosenOptionalCount <= (jadwal?.max_mapel_pilihan ?? 0));

  const toggleSelectMapel = (pelajaranId?: number | null) => {
    if (!pelajaranId) return;
    const mapel = mapelPilihan.find((m) => m.id === pelajaranId);
    if (mapel?.wajib) return;

    setSelectedPelajaranIds((current) => {
      const isChecked = current.includes(pelajaranId);
      if (isChecked) {
        return current.filter((id) => id !== pelajaranId);
      } else {
        const max = jadwal?.max_mapel_pilihan ?? 999;
        const currentOptional = current.filter((id) => !mapelPilihan.find((m) => m.id === id)?.wajib);
        if (max === 1 && currentOptional.length >= 1) {
          const wajibIds = current.filter((id) => mapelPilihan.find((m) => m.id === id)?.wajib);
          return [...wajibIds, pelajaranId];
        }
        if (currentOptional.length >= max) {
          return current;
        }
        return [...current, pelajaranId];
      }
    });
  };

  const startExam = async () => {
    if (!jadwal) return;
    if (isTkaSelection && !selectionValid) {
      setError(`Pilih minimal ${jadwal.min_mapel_pilihan} dan maksimal ${jadwal.max_mapel_pilihan} mapel pilihan terlebih dahulu.`);
      return;
    }
    setStarting(true);
    setError("");
    try {
      const response = await api.post("/ujian-siswa/mulai", {
        jadwal_ujian_id: jadwal.jadwal_ujian_id,
        ...(isTkaSelection ? { selected_pelajaran_ids: selectedPelajaranIds } : {}),
      });
      router.push(`/siswa/ujian/${response.data.ujian_siswa_id}`);
    } catch (err: any) {
      setError(getErrorMessage(err, "Ujian belum dapat dimulai."));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!autoMulai || loading || !jadwal || autoTriggeredRef.current) return;
    if (jadwal.izinkan_pilih_mapel === false) {
      if (selesaiUjianId !== null) {
        autoTriggeredRef.current = true;
        router.replace(`/siswa/hasil/${selesaiUjianId}`);
      } else if (activeUjianId !== null) {
        autoTriggeredRef.current = true;
        router.replace(`/siswa/ujian/${activeUjianId}`);
      } else if (jadwal.status === "berlangsung") {
        autoTriggeredRef.current = true;
        startExam();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, jadwal, activeUjianId, selesaiUjianId]);

  const startLatihanMapel = async (bagianId: number) => {
    if (!jadwal) return;
    setStartingBagianId(bagianId);
    setError("");
    try {
      const { data } = await api.post("/ujian-siswa/mulai-latihan", {
        paket_ujian_id: jadwal.paket_ujian_id,
        mode: "latihan",
        bagian_id: bagianId,
      });
      router.push(`/siswa/ujian/${data.ujian_siswa_id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Latihan mapel gagal dimulai."));
    } finally {
      setStartingBagianId(null);
    }
  };

  const canStart = jadwal?.status === "berlangsung" && activeUjianId === null && selesaiUjianId === null;
  const bisaPilihMapel = jadwal?.izinkan_pilih_mapel !== false && selesaiUjianId !== null;
  const bagianList = useMemo(
    () => (jadwal?.bagian && jadwal.bagian.length > 0 ? jadwal.bagian : jadwal ? [{ bagian_id: -1, nama: "Umum", urutan: 1, jumlah_soal: jadwal.jumlah_soal }] : []),
    [jadwal],
  );

  const renderSectionActions = (b: { bagian_id: number; nama: string; pelajaran_id?: number | null; wajib?: boolean }) => {
    if (!jadwal) return null;
    if (selesaiUjianId !== null) {
      return (
        <Link className="student-btn" href={`/siswa/hasil/${selesaiUjianId}`}>
          <CheckCircle2 size={15} aria-hidden="true" /> Hasil
        </Link>
      );
    }
    if (activeUjianId !== null) {
      return (
        <Link className="student-btn" href={`/siswa/ujian/${activeUjianId}`}>
          <Play size={15} aria-hidden="true" /> Lanjutkan
        </Link>
      );
    }
    if (canStart) {
      if (isTkaSelection && b.pelajaran_id != null) {
        const isWajib = b.wajib !== false;
        const isSelected = isWajib || selectedPelajaranIds.includes(b.pelajaran_id);
        if (isSelected) {
          return (
            <button
              type="button"
              className="student-btn"
              disabled={starting || !selectionValid}
              onClick={startExam}
            >
              <Play size={15} aria-hidden="true" /> {starting ? "Memuat..." : "Mulai"}
            </button>
          );
        }
        return (
          <button
            type="button"
            className="student-btn student-btn-outline"
            onClick={() => toggleSelectMapel(b.pelajaran_id)}
          >
            Pilih Mapel Ini
          </button>
        );
      }

      return (
        <button className="student-btn" disabled={starting || !selectionValid} onClick={startExam}>
          <Play size={15} aria-hidden="true" /> {starting ? "Memuat..." : "Mulai"}
        </button>
      );
    }
    if (jadwal.status === "mendatang") {
      return <span className="student-pill student-pill-amber">Segera</span>;
    }
    return <span className="student-pill student-pill-muted">Berakhir</span>;
  };

  if (loading) {
    return (
      <main className="student-home student-split-page">
        <p className="student-notice mt-6">Memuat detail ujian...</p>
      </main>
    );
  }

  if (
    autoMulai &&
    jadwal &&
    jadwal.izinkan_pilih_mapel === false &&
    (selesaiUjianId !== null || activeUjianId !== null || jadwal.status === "berlangsung")
  ) {
    return (
      <main className="student-home student-split-page">
        <p className="student-notice mt-6">Menyiapkan ujian...</p>
      </main>
    );
  }

  return (
    <main className="student-home student-split-page">
      <Link href={backHref} className="student-back">
        <ArrowLeft size={15} aria-hidden="true" /> Kembali
      </Link>

      {error && <p role="alert" className="student-notice mt-4 mb-4">{error}</p>}

      {jadwal && (
        <>
          <header className="student-split-head">
            <h1>{jadwal.nama_paket}</h1>
            {jadwal.status !== "berakhir" && (
              <p className="student-muted mt-1">
                {jadwal.status === "mendatang" && <>Dibuka {formatWaktuJadwal(jadwal.mulai)} · </>}
                Ditutup <strong>{formatWaktuJadwal(jadwal.selesai)}</strong>
              </p>
            )}
          </header>

          <section className="student-split-main" aria-live="polite">
            {jadwal.izinkan_pilih_mapel === false ? (
              <ul className="student-set-list student-set-list-single">
                <li className="student-set">
                  <div className="student-meta">
                    <span><FileText size={14} aria-hidden="true" />{jadwal.jumlah_soal ?? 0} soal</span>
                    <span><Clock3 size={14} aria-hidden="true" />{durasiSingkat(jadwal.durasi_menit)}</span>
                  </div>
                  <p className="student-muted text-xs">Mapel dikerjakan berurutan sesuai jadwal, dibuka satu per satu saat pengerjaan.</p>
                  <div className="student-set-actions">{renderSectionActions({ bagian_id: -1, nama: "Umum" })}</div>
                </li>
              </ul>
            ) : (
              <>
                {isTkaSelection && (
                  <div className="mb-5 rounded-card border border-brand-primary/20 bg-brand-primary/5 p-4">
                    <h2 className="font-bold text-heading-dark">Pilih Mapel TKA</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      {jumlahMapelWajib > 0 ? `${jumlahMapelWajib} mapel wajib akan dikerjakan otomatis. ` : "Tidak ada mapel wajib. "}
                      Pilih minimal {jadwal.min_mapel_pilihan} dan maksimal {jadwal.max_mapel_pilihan} mapel pilihan.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {mapelPilihan.map((mapel) => {
                        const checked = selectedPelajaranIds.includes(mapel.id);
                        return (
                          <label
                            key={mapel.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-input border p-3 transition-colors ${mapel.wajib ? "border-green-200 bg-green-50" : checked ? "border-brand-primary bg-white shadow-sm" : "border-card-border bg-white"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={mapel.wajib}
                              onChange={() => toggleSelectMapel(mapel.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <strong className="block text-sm text-heading-dark">{mapel.nama}</strong>
                              <small className="text-xs text-text-muted">{mapel.wajib ? "Wajib" : "Pilihan"} · {mapel.jumlahSoal} soal</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className={`mt-3 text-xs font-semibold ${selectionValid ? "text-green-700" : "text-amber-700"}`}>
                      Pilihan mapel: {chosenOptionalCount} dari {jadwal.min_mapel_pilihan ?? 0}-{jadwal.max_mapel_pilihan ?? 0}
                      {!selectionValid && ` (Pilih ${(jadwal.min_mapel_pilihan ?? 0) - chosenOptionalCount > 0 ? `${(jadwal.min_mapel_pilihan ?? 0) - chosenOptionalCount} mapel lagi` : `maksimal ${jadwal.max_mapel_pilihan ?? 0} mapel`})`}
                    </p>
                  </div>
                )}
                {bagianList.length === 0 ? (
                  <p className="student-notice">Belum ada set soal pada paket ini.</p>
                ) : (
                  <SetSoalPerMapel
                    items={bagianList}
                    renderMeta={(b) => {
                      const isWajib = b.wajib !== false;
                      const isSelected = isWajib || (b.pelajaran_id != null && selectedPelajaranIds.includes(b.pelajaran_id));
                      return (
                        <div className="student-meta">
                          <span><FileText size={14} aria-hidden="true" />{b.jumlah_soal ?? 0} soal</span>
                          <span><Clock3 size={14} aria-hidden="true" />{durasiSingkat(jadwal.durasi_menit)}</span>
                          {isTkaSelection && b.pelajaran_id != null && (
                            isWajib ? (
                              <span className="font-semibold text-green-700">Wajib</span>
                            ) : isSelected ? (
                              <span className="font-semibold text-brand-primary">Dipilih</span>
                            ) : (
                              <span className="font-medium text-text-muted">Belum dipilih</span>
                            )
                          )}
                        </div>
                      );
                    }}
                    renderActions={(b) => (
                      <>
                        {renderSectionActions(b)}
                        {bisaPilihMapel && b.bagian_id !== -1 && (
                          <button
                            type="button"
                            className="student-btn student-btn-outline"
                            disabled={startingBagianId !== null}
                            onClick={() => startLatihanMapel(b.bagian_id)}
                          >
                            <BookOpen size={15} aria-hidden="true" /> {startingBagianId === b.bagian_id ? "Memuat..." : "Latihan"}
                          </button>
                        )}
                      </>
                    )}
                  />
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
