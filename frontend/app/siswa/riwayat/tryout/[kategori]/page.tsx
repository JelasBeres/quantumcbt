"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck, Search } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import RiwayatPaging, { useDataPerItem, useHalaman } from "@/components/RiwayatPaging";
import {
  DetailHasil,
  KATEGORI_LAINNYA,
  Ringkasan,
  RiwayatItem,
  fetchRiwayatTryout,
  formatSkor,
  formatTanggal,
  kategoriKey,
  ringkas,
} from "@/lib/riwayat";

// Riwayat langkah 2: tryout yang sudah dikerjakan pada kategori terpilih.
export default function RiwayatPerKategoriPage() {
  const params = useParams<{ kategori: string }>();
  const kategori = decodeURIComponent(params.kategori);
  const [items, setItems] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cari, setCari] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cocok = (await fetchRiwayatTryout()).filter((item) => kategoriKey(item) === kategori);
        if (cancelled) return;
        setItems(cocok);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e, "Riwayat gagal dimuat."));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [kategori]);

  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return kata ? items.filter((item) => item.nama_paket.toLowerCase().includes(kata)) : items;
  }, [items, cari]);

  const paging = useHalaman(hasilCari, cari);
  // Ringkasan benar/salah hanya diambil untuk kartu di halaman yang tampil.
  const ambilRingkasan = useCallback(async (id: number): Promise<Ringkasan & { ditahan: boolean }> => {
    const { data } = await api.get<DetailHasil>(`/hasil-ujian/ujian/${id}/detail`);
    const ditahan = !!data.kunci_disembunyikan;
    return { ...ringkas(data.soal ?? [], ditahan), ditahan };
  }, []);
  const ringkasan = useDataPerItem(paging.tampil.map((item) => item.ujian_siswa_id), ambilRingkasan);

  const labelKategori = items[0]?.kategori_nama || (kategori === KATEGORI_LAINNYA ? "Lainnya" : kategori.replace(/_/g, " ").toUpperCase());

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/riwayat/tryout" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Kategori Try Out</Link>
      <header className="student-split-head">
        <h1>Riwayat Try Out {labelKategori}</h1>
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {!loading && items.length > 1 && (
        <label className="student-search mt-5">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari try out..." aria-label="Cari try out" />
        </label>
      )}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : items.length === 0 ? (
        <p className="student-notice mt-6">Belum ada try out yang selesai pada kategori ini.</p>
      ) : hasilCari.length === 0 ? (
        <p className="student-notice mt-6">Tidak ada try out yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
      ) : (
        <>
        <div className="student-tryouts student-list-compact">
          {paging.tampil.map((item) => {
            const r = ringkasan[item.ujian_siswa_id];
            return (
              <article key={item.ujian_siswa_id} className="student-tryout">
                <div className="student-tryout-cover">
                  <div className="student-tryout-top">
                    <span className="student-pill">
                      {item.metode_penilaian === "kohort" ? `Skor ${(item.skala ?? "utbk").toUpperCase()}` : "Nilai"} {formatSkor(item)}
                    </span>
                    {item.metode_penilaian === "kohort" && item.kohort_status === "sementara" && (
                      <span className="student-pill student-pill-amber">Sementara</span>
                    )}
                  </div>
                  <div>
                    <h3>{item.nama_paket}</h3>
                    {r && (r.ditahan ? (
                      <p className="student-tryout-sub">Kunci & pembahasan tersedia setelah jadwal berakhir</p>
                    ) : (
                      <p className="student-tryout-sub">
                        {r.benar} benar · {r.salah} salah · {r.kosong} kosong{r.menunggu > 0 ? ` · ${r.menunggu} menunggu koreksi` : ""}{r.ragu > 0 ? ` · ${r.ragu} ragu-ragu` : ""}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="student-tryout-body">
                  <div className="student-meta">
                    <span><CalendarCheck size={15} aria-hidden="true" />Selesai {formatTanggal(item.finished_at)}</span>
                  </div>
                  <Link className="student-primary-link" href={`/siswa/riwayat/tryout/${encodeURIComponent(kategori)}/${item.ujian_siswa_id}`}>
                    Lihat Mapel <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        <RiwayatPaging {...paging} onGanti={paging.setHalaman} />
        </>
      )}
    </main>
  );
}
