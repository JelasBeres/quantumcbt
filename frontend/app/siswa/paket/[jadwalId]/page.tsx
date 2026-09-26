"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { ArrowLeft, CheckCircle2, Clock3, FileText, Play, BookOpen } from "lucide-react";
import SetSoalPerMapel, { durasiSingkat } from "@/components/SetSoalPerMapel";
import { formatWaktuJadwal } from "@/lib/waktu-jadwal";

// Detail 1 jadwal tryout: kiri daftar mapel, kanan kartu set soal (bagian) mapel tersebut.
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
  bagian?: { bagian_id: number; nama: string; urutan: number; jumlah_soal?: number; pelajaran_id?: number | null; pelajaran_nama?: string | null }[];
  pelajaran?: string | null;
  deskripsi_paket?: string | null;
  izinkan_pilih_mapel?: boolean;
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
  // ?mulai=1 hanya dikirim tombol "Mulai Ujian"/"Mulai Try Out". Dari tempat lain
  // (mis. popup pemberitahuan) halaman ini cuma menampilkan paket, belum mulai ujian.
  const autoMulai = searchParams.get("mulai") === "1";
  const backHref = kategori ? `/siswa/tryout/${encodeURIComponent(kategori)}` : "/siswa/tryout";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [jadwal, setJadwal] = useState<Jadwal | null>(null);
  const [activeUjianId, setActiveUjianId] = useState<number | null>(null);
  const [selesaiUjianId, setSelesaiUjianId] = useState<number | null>(null);
  const [startingBagianId, setStartingBagianId] = useState<number | null>(null);
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

  const startExam = async () => {
    if (!jadwal) return;
    setStarting(true);
    setError("");
    try {
      const response = await api.post("/ujian-siswa/mulai", {
        jadwal_ujian_id: jadwal.jadwal_ujian_id,
      });
      router.push(`/siswa/ujian/${response.data.ujian_siswa_id}`);
    } catch (err: any) {
      setError(getErrorMessage(err, "Ujian belum dapat dimulai."));
    } finally {
      setStarting(false);
    }
  };

  // Paket dengan izinkan_pilih_mapel=false tidak menampilkan breakdown mapel:
  // kalau dibuka lewat tombol "Mulai Ujian" (?mulai=1), langsung teruskan ke
  // ujian/hasil tanpa butuh klik tambahan di halaman ini.
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
  // Latihan per mapel baru muncul setelah tryout selesai, supaya soal tidak bisa diintip lebih dulu.
  const bisaPilihMapel = jadwal?.izinkan_pilih_mapel !== false && selesaiUjianId !== null;
  const bagianList = useMemo(
    () => (jadwal?.bagian && jadwal.bagian.length > 0 ? jadwal.bagian : jadwal ? [{ bagian_id: -1, nama: "Umum", urutan: 1, jumlah_soal: jadwal.jumlah_soal }] : []),
    [jadwal],
  );

  const actionNode = (() => {
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
      return (
        <button className="student-btn" disabled={starting} onClick={startExam}>
          <Play size={15} aria-hidden="true" /> {starting ? "Memuat..." : "Mulai"}
        </button>
      );
    }
    if (jadwal.status === "mendatang") {
      return <span className="student-pill student-pill-amber">Segera</span>;
    }
    return <span className="student-pill student-pill-muted">Berakhir</span>;
  })();

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
                  <div className="student-set-actions">{actionNode}</div>
                </li>
              </ul>
            ) : (
              <>
            {bagianList.length === 0 ? (
              <p className="student-notice">Belum ada set soal pada paket ini.</p>
            ) : (
              <SetSoalPerMapel
                items={bagianList}
                renderMeta={(b) => (
                  <div className="student-meta">
                    <span><FileText size={14} aria-hidden="true" />{b.jumlah_soal ?? 0} soal</span>
                    <span><Clock3 size={14} aria-hidden="true" />{durasiSingkat(jadwal.durasi_menit)}</span>
                  </div>
                )}
                renderActions={(b) => (
                  <>
                    {actionNode}
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
