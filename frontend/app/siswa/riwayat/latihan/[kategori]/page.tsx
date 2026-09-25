"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck, Layers, Search } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import RiwayatPaging, { useHalaman } from "@/components/RiwayatPaging";
import {
  KATEGORI_LAINNYA,
  RiwayatLatihanItem,
  fetchRiwayatLatihan,
  formatTanggal,
  kategoriKey,
  kelompokkanPerMapel,
} from "@/lib/riwayat";

// Riwayat Latihan langkah 2: mapel pada kategori terpilih -> (langkah 3) set soal -> pembahasan.
export default function RiwayatLatihanPerKategoriPage() {
  const params = useParams<{ kategori: string }>();
  const kategori = decodeURIComponent(params.kategori);
  const [items, setItems] = useState<RiwayatLatihanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cari, setCari] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cocok = (await fetchRiwayatLatihan()).filter((item) => kategoriKey(item) === kategori);
        if (!cancelled) setItems(cocok);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Riwayat latihan gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kategori]);

  const mapel = useMemo(() => kelompokkanPerMapel(items), [items]);
  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return mapel;
    return mapel.filter((grup) => [grup.nama, ...grup.sets.map((set) => set.nama)].join(" ").toLowerCase().includes(kata));
  }, [mapel, cari]);
  const paging = useHalaman(hasilCari, cari);

  const labelKategori = items[0]?.kategori_nama || (kategori === KATEGORI_LAINNYA ? "Lainnya" : kategori.replace(/_/g, " ").toUpperCase());

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/riwayat/latihan" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Kategori Latihan</Link>
      <header className="student-split-head">
        <h1>Riwayat Latihan {labelKategori}</h1>
        <p className="student-muted mt-1">Pilih mapel untuk melihat pembahasan setiap set soal yang sudah kamu kerjakan.</p>
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {!loading && mapel.length > 1 && (
        <label className="student-search mt-5">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari mapel atau set soal..." aria-label="Cari mapel" />
        </label>
      )}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : mapel.length === 0 ? (
        <p className="student-notice mt-6">Belum ada latihan yang selesai pada kategori ini.</p>
      ) : hasilCari.length === 0 ? (
        <p className="student-notice mt-6">Tidak ada mapel yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
      ) : (
        <>
          <div className="student-tryouts student-list-compact">
            {paging.tampil.map((grup) => (
              <article key={grup.key} className="student-tryout">
                <div className="student-tryout-cover">
                  <div className="student-tryout-top">
                    <span className="student-pill">{grup.sets.length} set soal</span>
                  </div>
                  <div>
                    <h3>{grup.nama}</h3>
                    <p className="student-tryout-sub">{grup.jumlahSesi} kali latihan</p>
                  </div>
                </div>
                <div className="student-tryout-body">
                  <div className="student-meta">
                    <span><Layers size={15} aria-hidden="true" />{grup.sets.slice(0, 3).map((set) => set.nama).join(", ")}{grup.sets.length > 3 ? ", …" : ""}</span>
                    <span><CalendarCheck size={15} aria-hidden="true" />Terakhir {formatTanggal(grup.terakhir)}</span>
                  </div>
                  <Link className="student-primary-link" href={`/siswa/riwayat/latihan/${encodeURIComponent(kategori)}/${encodeURIComponent(grup.key)}`}>
                    Lihat Pembahasan <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <RiwayatPaging {...paging} onGanti={paging.setHalaman} />
        </>
      )}
    </main>
  );
}
