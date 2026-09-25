"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck, History, Search } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import RiwayatPaging, { useDataPerItem, useHalaman } from "@/components/RiwayatPaging";
import {
  DetailHasil,
  Ringkasan,
  RiwayatLatihanItem,
  fetchRiwayatLatihan,
  formatTanggal,
  kategoriKey,
  kelompokkanPerMapel,
  ringkas,
} from "@/lib/riwayat";

// Riwayat Latihan langkah 3: set soal satu mapel -> pembahasan. Setiap set menampilkan
// percobaan terbarunya; percobaan sebelumnya berupa tautan kecil di bawah kartu.
function labelMode(item: RiwayatLatihanItem): string {
  if (item.sumber === "tryout") return "Latihan mapel try out";
  return item.mode_latihan === "drill" ? "Mode Drilling" : "Mode Ujian";
}

export default function RiwayatLatihanPerMapelPage() {
  const params = useParams<{ kategori: string; mapel: string }>();
  const kategori = decodeURIComponent(params.kategori);
  const mapelParam = decodeURIComponent(params.mapel);
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

  const grup = useMemo(() => kelompokkanPerMapel(items).find((g) => g.key === mapelParam), [items, mapelParam]);
  const sets = useMemo(() => grup?.sets ?? [], [grup]);
  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return kata ? sets.filter((set) => `${set.nama} ${set.nama_paket}`.toLowerCase().includes(kata)) : sets;
  }, [sets, cari]);
  const paging = useHalaman(hasilCari, cari);

  // Ringkasan benar/salah hanya untuk percobaan terbaru set yang tampil.
  const ambilRingkasan = useCallback(async (id: number): Promise<Ringkasan> => {
    const { data } = await api.get<DetailHasil>(`/hasil-ujian/ujian/${id}/detail`);
    return ringkas(data.soal ?? []);
  }, []);
  const ringkasan = useDataPerItem(paging.tampil.map((set) => set.sesi[0].ujian_siswa_id), ambilRingkasan);

  const hrefKategori = `/siswa/riwayat/latihan/${encodeURIComponent(kategori)}`;
  const hrefPembahasan = (item: RiwayatLatihanItem) =>
    `/siswa/hasil/${item.ujian_siswa_id}?${new URLSearchParams({ kategori, jenis: "latihan", mapel: mapelParam }).toString()}`;

  return (
    <main className="student-home student-split-page">
      <Link href={hrefKategori} className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Daftar Mapel</Link>
      <header className="student-split-head">
        <h1>Pembahasan {grup?.nama ?? "Latihan"}</h1>
        {grup && <p className="student-muted mt-1">Pilih set soal untuk melihat pembahasannya.</p>}
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {!loading && sets.length > 1 && (
        <label className="student-search mt-5">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari set soal..." aria-label="Cari set soal" />
        </label>
      )}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : !grup ? (
        <p className="student-notice mt-6">Belum ada latihan yang selesai untuk mapel ini. <Link href={hrefKategori} className="underline">Kembali ke daftar mapel</Link></p>
      ) : hasilCari.length === 0 ? (
        <p className="student-notice mt-6">Tidak ada set soal yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
      ) : (
        <>
          <div className="student-tryouts student-list-compact">
            {paging.tampil.map((set) => {
              const [terbaru, ...sebelumnya] = set.sesi;
              const r = ringkasan[terbaru.ujian_siswa_id];
              return (
                <article key={set.key} className="student-tryout">
                  <div className="student-tryout-cover">
                    <div className="student-tryout-top">
                      <span className="student-pill">{terbaru.skor != null ? `Nilai ${terbaru.skor.toFixed(1)}` : labelMode(terbaru)}</span>
                      {terbaru.skor != null && <span className="student-pill">{labelMode(terbaru)}</span>}
                    </div>
                    <div>
                      <h3>{set.nama}</h3>
                      {set.nama !== set.nama_paket && <p className="student-tryout-sub">{set.nama_paket}</p>}
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
                      <span><CalendarCheck size={15} aria-hidden="true" />Selesai {formatTanggal(terbaru.finished_at)}</span>
                      {sebelumnya.length > 0 && <span><History size={15} aria-hidden="true" />{set.sesi.length} kali dikerjakan</span>}
                    </div>
                    <Link className="student-primary-link" href={hrefPembahasan(terbaru)}>
                      Lihat Pembahasan <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {sebelumnya.length > 0 && (
                      <div className="student-attempts">
                        <p>Percobaan sebelumnya</p>
                        <ul>
                          {sebelumnya.map((sesi, index) => (
                            <li key={sesi.ujian_siswa_id}>
                              <Link href={hrefPembahasan(sesi)}>
                                <span>Ke-{set.sesi.length - 1 - index} · {formatTanggal(sesi.finished_at)}</span>
                                <span>{sesi.skor != null ? `Nilai ${sesi.skor.toFixed(1)}` : labelMode(sesi)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
