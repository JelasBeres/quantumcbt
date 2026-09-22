"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { ArrowLeft, Clock3, FileText, X } from "lucide-react";

// Detail 1 paket latihan: kiri daftar mapel (bagian), kanan card soal per mapel.
// Setiap card = 1 bagian; tombol Mulai pada card itu HANYA memulai soal bagian tersebut
// (bukan seluruh paket), jadi jumlah soal yang dikerjakan sama dengan yang tertulis di card.
type Bagian = { bagian_id: number; nama: string; pelajaran_id?: number | null; durasi_menit?: number | null; jumlah_soal?: number };
type Latihan = {
  id: number;
  nama: string;
  deskripsi?: string | null;
  durasi_menit: number;
  jumlah_soal: number;
  kategori_nama?: string | null;
  bagian?: Bagian[];
};

function formatDurasi(menit: number) {
  if (!menit) return "-";
  if (menit < 60) return `${menit} Menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa > 0 ? `${jam} Jam ${sisa} Menit` : `${jam} Jam`;
}

export default function DetailLatihanPage() {
  const params = useParams<{ kategori: string; latihanId: string }>();
  const router = useRouter();
  const latihanId = Number(params.latihanId);
  const kategori = decodeURIComponent(params.kategori);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [latihan, setLatihan] = useState<Latihan | null>(null);
  const [pilihMode, setPilihMode] = useState<Bagian | null>(null);
  const [starting, setStarting] = useState<"latihan" | "drill" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<Latihan[]>("/siswa/latihan");
        if (cancelled) return;
        const found = (data ?? []).find((item) => item.id === latihanId);
        if (!found) {
          setError("Latihan tidak ditemukan.");
          return;
        }
        setLatihan(found);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, "Latihan gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latihanId]);

  useEffect(() => {
    if (!pilihMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && starting === null) setPilihMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pilihMode, starting]);

  const bagianList = useMemo<Bagian[]>(
    () => (latihan?.bagian && latihan.bagian.length > 0 ? latihan.bagian : latihan ? [{ bagian_id: -1, nama: "Umum", jumlah_soal: latihan.jumlah_soal }] : []),
    [latihan],
  );

  const mulai = async (bagian: Bagian, mode: "latihan" | "drill") => {
    if (!latihan) return;
    setStarting(mode);
    setError("");
    try {
      const { data } = await api.post("/ujian-siswa/mulai-latihan", {
        paket_ujian_id: latihan.id,
        mode,
        bagian_id: bagian.bagian_id === -1 ? undefined : bagian.bagian_id,
      });
      router.push(`/siswa/ujian/${data.ujian_siswa_id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Latihan gagal dimulai."));
      setStarting(null);
      setPilihMode(null);
    }
  };

  if (loading) {
    return (
      <main className="student-home student-split-page">
        <p className="student-notice mt-6">Memuat detail latihan...</p>
      </main>
    );
  }

  return (
    <main className="student-home student-split-page">
      <Link href={`/siswa/latihan/${encodeURIComponent(kategori)}`} className="student-back">
        <ArrowLeft size={15} aria-hidden="true" /> Kembali
      </Link>

      {error && <p role="alert" className="student-notice mt-4 mb-4">{error}</p>}

      {latihan && (
        <>
          <header className="student-split-head">
            <h1>{latihan.nama}</h1>
            {latihan.deskripsi && <p className="student-muted mt-1">{latihan.deskripsi}</p>}
          </header>

          <section className="student-split-main" aria-live="polite">
            <p className="student-split-label">Daftar Mapel</p>
            {bagianList.length === 0 ? (
              <p className="student-notice">Belum ada mapel pada latihan ini.</p>
            ) : (
              <ul className="student-set-list">
                {bagianList.map((b, i) => (
                  <li key={b.bagian_id} className="student-set">
                    <span className="student-set-no">{i + 1}</span>
                    <h3>{b.nama}</h3>
                    <div className="student-meta">
                      <span><FileText size={14} aria-hidden="true" />{b.jumlah_soal ?? 0} soal</span>
                      <span><Clock3 size={14} aria-hidden="true" />{formatDurasi(b.durasi_menit ?? latihan.durasi_menit)}</span>
                    </div>
                    <div className="student-set-actions">
                      <button className="student-btn" onClick={() => setPilihMode(b)}>Mulai</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {pilihMode && latihan && (
        <div className="student-modal-backdrop" onClick={() => starting === null && setPilihMode(null)}>
          <div className="student-modal" role="dialog" aria-modal="true" aria-labelledby="mode-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="student-modal-close" aria-label="Tutup" disabled={starting !== null} onClick={() => setPilihMode(null)}>
              <X size={18} aria-hidden="true" />
            </button>
            <h2 id="mode-title">{pilihMode.nama}</h2>
            <p className="student-muted">{pilihMode.jumlah_soal ?? 0} soal · {formatDurasi(pilihMode.durasi_menit ?? latihan.durasi_menit)}</p>
            <div className="student-mode-grid">
              <button type="button" className="student-mode" disabled={starting !== null} onClick={() => mulai(pilihMode, "latihan")}>
                <strong>{starting === "latihan" ? "Membuka…" : "Mode Ujian"}</strong>
                <ul>
                  <li>Timer resmi berjalan</li>
                  <li>Pembahasan lengkap setelah semua soal selesai</li>
                </ul>
              </button>
              <button type="button" className="student-mode" disabled={starting !== null} onClick={() => mulai(pilihMode, "drill")}>
                <strong>{starting === "drill" ? "Membuka…" : "Mode Drilling"}</strong>
                <ul>
                  <li>Tanpa timer</li>
                  <li>Konfirmasi jawaban tiap soal untuk langsung melihat hasil, kunci, dan pembahasan</li>
                </ul>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
