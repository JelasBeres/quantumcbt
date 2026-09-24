"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck, Search } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import {
  DetailHasil,
  KATEGORI_LAINNYA,
  Ringkasan,
  RiwayatLatihanItem,
  fetchRiwayatLatihan,
  formatTanggal,
  kategoriKey,
  ringkas,
} from "@/lib/riwayat";

// Riwayat Latihan langkah 2: sesi latihan pada kategori terpilih -> pembahasan.
function labelMode(item: RiwayatLatihanItem): string {
  if (item.sumber === "tryout") return "Latihan mapel tryout";
  return item.mode_latihan === "drill" ? "Mode Drilling" : "Mode Ujian";
}

export default function RiwayatLatihanPerKategoriPage() {
  const params = useParams<{ kategori: string }>();
  const kategori = decodeURIComponent(params.kategori);
  const [items, setItems] = useState<RiwayatLatihanItem[]>([]);
  const [ringkasan, setRingkasan] = useState<Record<number, Ringkasan | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cari, setCari] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cocok = (await fetchRiwayatLatihan()).filter((item) => kategoriKey(item) === kategori);
        if (cancelled) return;
        setItems(cocok);
        setLoading(false);
        const entries = await Promise.all(cocok.map(async (item) => {
          try {
            const { data } = await api.get<DetailHasil>(`/hasil-ujian/ujian/${item.ujian_siswa_id}/detail`);
            return [item.ujian_siswa_id, ringkas(data.soal ?? [])] as const;
          } catch {
            return [item.ujian_siswa_id, null] as const;
          }
        }));
        if (!cancelled) setRingkasan(Object.fromEntries(entries));
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e, "Riwayat latihan gagal dimuat."));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [kategori]);

  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return items;
    return items.filter((item) =>
      [item.nama_paket, item.pelajaran_nama, item.bagian_nama, labelMode(item)].filter(Boolean).join(" ").toLowerCase().includes(kata),
    );
  }, [items, cari]);

  const labelKategori = items[0]?.kategori_nama || (kategori === KATEGORI_LAINNYA ? "Lainnya" : kategori.replace(/_/g, " ").toUpperCase());
  const hrefPembahasan = (item: RiwayatLatihanItem) =>
    `/siswa/hasil/${item.ujian_siswa_id}?${new URLSearchParams({ kategori, jenis: "latihan" }).toString()}`;

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/riwayat/latihan" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Kategori Latihan</Link>
      <header className="student-split-head">
        <h1>Riwayat Latihan {labelKategori}</h1>
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {!loading && items.length > 1 && (
        <label className="student-search mt-5">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari latihan atau mapel..." aria-label="Cari latihan" />
        </label>
      )}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : items.length === 0 ? (
        <p className="student-notice mt-6">Belum ada latihan yang selesai pada kategori ini.</p>
      ) : hasilCari.length === 0 ? (
        <p className="student-notice mt-6">Tidak ada latihan yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
      ) : (
        <div className="student-tryouts mt-6">
          {hasilCari.map((item) => {
            const r = ringkasan[item.ujian_siswa_id];
            const mapel = item.pelajaran_nama || item.bagian_nama;
            return (
              <article key={item.ujian_siswa_id} className="student-tryout">
                <div className="student-tryout-cover">
                  <div className="student-tryout-top">
                    <span className="student-pill">{item.skor != null ? `Nilai ${item.skor.toFixed(1)}` : labelMode(item)}</span>
                    {item.skor != null && <span className="student-pill">{labelMode(item)}</span>}
                  </div>
                  <div>
                    <h3>{item.nama_paket}</h3>
                    {mapel && <p className="student-tryout-sub">{mapel}</p>}
                    {r && (
                      <p className="student-tryout-sub">
                        {r.benar} benar · {r.salah} salah · {r.kosong} kosong
                        {r.menunggu > 0 ? ` · ${r.menunggu} menunggu koreksi` : ""}
                        {r.ragu > 0 ? ` · ${r.ragu} ragu-ragu` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="student-tryout-body">
                  <div className="student-meta">
                    <span><CalendarCheck size={15} aria-hidden="true" />Selesai {formatTanggal(item.finished_at)}</span>
                  </div>
                  <Link className="student-primary-link" href={hrefPembahasan(item)}>
                    Lihat Pembahasan <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
