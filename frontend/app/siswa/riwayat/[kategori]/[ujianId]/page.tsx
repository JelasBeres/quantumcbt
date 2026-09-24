"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleDashed, FileText, X } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import SetSoalPerMapel from "@/components/SetSoalPerMapel";
import { DetailHasil, RiwayatItem, fetchRiwayatTryout, formatSkor, formatTanggal, ringkas } from "@/lib/riwayat";

// Riwayat langkah 3: mapel & set soal dari satu tryout; tiap set membuka pembahasan mapel itu.
// Soal di luar bagian mana pun ("Bagian lainnya") memakai kunci bagian "none".
const TANPA_BAGIAN = -1;

type SetRiwayat = {
  bagian_id: number;
  nama: string;
  pelajaran_id?: number | null;
  pelajaran_nama?: string | null;
  jumlah_soal: number;
  benar: number;
  salah: number;
  kosong: number;
  menunggu: number;
  terjawab: number;
};

export default function RiwayatMapelPage() {
  const params = useParams<{ kategori: string; ujianId: string }>();
  const kategori = decodeURIComponent(params.kategori);
  const ujianId = Number(params.ujianId);
  const [detail, setDetail] = useState<DetailHasil | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [detailRes, daftar] = await Promise.all([
          api.get<DetailHasil>(`/hasil-ujian/ujian/${ujianId}/detail`),
          fetchRiwayatTryout(),
        ]);
        if (cancelled) return;
        setDetail(detailRes.data);
        setRiwayat(daftar.find((item) => item.ujian_siswa_id === ujianId) ?? null);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Hasil tryout gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ujianId]);

  const ditahan = !!detail?.kunci_disembunyikan;
  const sets = useMemo<SetRiwayat[]>(() => {
    if (!detail) return [];
    const bagianList = detail.bagian ?? [];
    const groups = bagianList.length > 0
      ? bagianList.map((b) => ({ ...b, key: b.bagian_id ?? TANPA_BAGIAN }))
      : [{ bagian_id: TANPA_BAGIAN, nama: "Semua Soal", urutan: 1, pelajaran_id: null, pelajaran_nama: null, key: TANPA_BAGIAN }];
    return groups.map((g) => {
      const soal = bagianList.length > 0
        ? detail.soal.filter((s) => (s.bagian_id ?? TANPA_BAGIAN) === g.key)
        : detail.soal;
      return {
        bagian_id: g.key,
        nama: g.nama,
        pelajaran_id: g.pelajaran_id,
        pelajaran_nama: g.pelajaran_nama,
        jumlah_soal: soal.length,
        ...ringkas(soal, ditahan),
      };
    });
  }, [detail, ditahan]);

  const hrefPembahasan = (bagianId?: number) => {
    const query = new URLSearchParams({ kategori });
    if (bagianId !== undefined && (detail?.bagian?.length ?? 0) > 0) {
      query.set("bagian", bagianId === TANPA_BAGIAN ? "none" : String(bagianId));
    }
    return `/siswa/hasil/${ujianId}?${query.toString()}`;
  };

  return (
    <main className="student-home student-split-page">
      <Link href={`/siswa/riwayat/${encodeURIComponent(kategori)}`} className="student-back">
        <ArrowLeft size={15} aria-hidden="true" /> Daftar Tryout
      </Link>

      {error && <p role="alert" className="student-notice mt-4 mb-4">{error}</p>}
      {loading ? <p className="student-notice mt-6">Memuat…</p> : detail && (
        <>
          <header className="student-split-head">
            <h1>{detail.nama_paket ?? riwayat?.nama_paket ?? "Hasil Tryout"}</h1>
            <p className="student-muted mt-1">
              {riwayat ? `Nilai ${formatSkor(riwayat)} · Selesai ${formatTanggal(riwayat.finished_at)}` : null}
            </p>
            {ditahan && (
              <p className="student-notice mt-3">
                Kunci jawaban dan pembahasan tersedia setelah jadwal tryout berakhir
                {detail.kunci_tersedia_at ? ` (${formatTanggal(detail.kunci_tersedia_at)})` : ""}.
              </p>
            )}
          </header>

          <section className="student-split-main" aria-live="polite">
            {sets.length === 0 ? (
              <p className="student-notice">Belum ada rincian soal.</p>
            ) : (
              <SetSoalPerMapel
                items={sets}
                renderMeta={(s) => (
                  <div className="student-meta">
                    <span><FileText size={14} aria-hidden="true" />{s.jumlah_soal} soal</span>
                    {ditahan ? (
                      <span><Check size={14} aria-hidden="true" />{s.terjawab} terjawab</span>
                    ) : (
                      <>
                        <span className="text-green-700"><Check size={14} aria-hidden="true" />{s.benar} benar</span>
                        <span className="text-red-700"><X size={14} aria-hidden="true" />{s.salah} salah</span>
                      </>
                    )}
                    <span><CircleDashed size={14} aria-hidden="true" />{s.kosong} kosong</span>
                    {!ditahan && s.menunggu > 0 && <span className="text-amber-700">{s.menunggu} menunggu koreksi</span>}
                  </div>
                )}
                renderActions={(s) => (
                  <Link className="student-btn" href={hrefPembahasan(s.bagian_id)}>
                    Lihat Pembahasan <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              />
            )}
            {sets.length > 1 && (
              <Link className="student-primary-link mt-6 inline-flex" href={hrefPembahasan()}>
                Lihat pembahasan semua mapel <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </section>
        </>
      )}
    </main>
  );
}
