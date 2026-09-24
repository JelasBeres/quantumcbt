"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { KATEGORI_LAINNYA, fetchRiwayatLatihan, kategoriKey } from "@/lib/riwayat";

// Riwayat Latihan langkah 1: pilih kategori (sama seperti menu Latihan), lalu sesi latihan.
type Kategori = { kode: string; nama: string; tipe: "ujian" | "latihan" | "keduanya"; is_active: boolean };

export default function RiwayatLatihanKategoriPage() {
  const [kategori, setKategori] = useState<{ kode: string; nama: string }[]>([]);
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [katRes, riwayat] = await Promise.all([api.get<Kategori[]>("/kategori-paket"), fetchRiwayatLatihan()]);
        if (cancelled) return;
        const count: Record<string, number> = {};
        const namaDariRiwayat: Record<string, string> = {};
        for (const item of riwayat) {
          const key = kategoriKey(item);
          count[key] = (count[key] ?? 0) + 1;
          if (item.kategori_nama) namaDariRiwayat[key] = item.kategori_nama;
        }
        const aktif = (katRes.data ?? [])
          .filter((k) => k.is_active && (k.tipe === "keduanya" || k.tipe === "latihan"))
          .map((k) => ({ kode: k.kode, nama: k.nama }));
        // Kategori di luar menu Latihan (mis. latihan per-mapel dari paket tryout,
        // atau kategori yang sudah nonaktif) tetap tampil bila siswa punya riwayatnya.
        const kodeAktif = new Set(aktif.map((k) => k.kode));
        const tambahan = Object.keys(count)
          .filter((kode) => kode !== KATEGORI_LAINNYA && !kodeAktif.has(kode))
          .map((kode) => ({ kode, nama: namaDariRiwayat[kode] ?? kode.replace(/_/g, " ").toUpperCase() }));
        const lainnya = count[KATEGORI_LAINNYA] ? [{ kode: KATEGORI_LAINNYA, nama: "Lainnya" }] : [];
        setJumlah(count);
        setKategori([...aktif, ...tambahan, ...lainnya]);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Riwayat latihan gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/riwayat" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Riwayat</Link>
      <header className="student-split-head">
        <h1>Riwayat Latihan</h1>
        <p className="student-muted mt-1">Pilih kategori untuk melihat latihan yang sudah kamu kerjakan.</p>
      </header>

      {error && <p role="alert" className="student-notice mt-4">{error}</p>}
      {loading ? <p className="student-notice mt-6">Memuat…</p> : kategori.length === 0 && !error ? (
        <p className="student-notice mt-6">Belum ada latihan yang selesai dikerjakan.</p>
      ) : (
        <div className="student-kategori-grid">
          {kategori.map((k) => {
            const n = jumlah[k.kode] ?? 0;
            const inner = (
              <>
                <strong>{k.nama}</strong>
                <span className="student-kategori-foot">
                  {n > 0 ? <><em>{n} sesi latihan</em><ArrowRight size={16} aria-hidden="true" /></> : <em>Belum ada riwayat</em>}
                </span>
              </>
            );
            return n > 0
              ? <Link key={k.kode} href={`/siswa/riwayat/latihan/${encodeURIComponent(k.kode)}`} className="student-kategori">{inner}</Link>
              : <div key={k.kode} className="student-kategori student-kategori-off" aria-disabled="true">{inner}</div>;
          })}
        </div>
      )}
    </main>
  );
}
