"use client";

import { CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardList, Lock } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { KATEGORI_LAINNYA, fetchRiwayatTryout, kategoriKey } from "@/lib/riwayat";

const WARNA_KATEGORI = ["#2d3c8f", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#0369a1"];

type Kategori = { kode: string; nama: string; tipe: "ujian" | "latihan" | "keduanya"; is_active: boolean };

export default function RiwayatKategoriPage() {
  const [kategori, setKategori] = useState<{ kode: string; nama: string }[]>([]);
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [katRes, riwayat] = await Promise.all([api.get<Kategori[]>("/kategori-paket"), fetchRiwayatTryout()]);
        if (cancelled) return;
        const count: Record<string, number> = {};
        const namaDariRiwayat: Record<string, string> = {};
        for (const item of riwayat) {
          const key = kategoriKey(item);
          count[key] = (count[key] ?? 0) + 1;
          if (item.kategori_nama) namaDariRiwayat[key] = item.kategori_nama;
        }
        const aktif = (katRes.data ?? [])
          .filter((k) => k.is_active && (k.tipe === "keduanya" || k.tipe === "ujian"))
          .map((k) => ({ kode: k.kode, nama: k.nama }));
        const kodeAktif = new Set(aktif.map((k) => k.kode));
        const tambahan = Object.keys(count)
          .filter((kode) => kode !== KATEGORI_LAINNYA && !kodeAktif.has(kode))
          .map((kode) => ({ kode, nama: namaDariRiwayat[kode] ?? kode.replace(/_/g, " ").toUpperCase() }));
        const lainnya = count[KATEGORI_LAINNYA] ? [{ kode: KATEGORI_LAINNYA, nama: "Lainnya" }] : [];
        setJumlah(count);
        setKategori([...aktif, ...tambahan, ...lainnya]);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Riwayat gagal dimuat."));
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
        <h1>Riwayat Try Out</h1>
        <p className="student-muted mt-1">Pilih kategori untuk melihat try out yang sudah kamu kerjakan.</p>
      </header>

      {error && <p role="alert" className="student-notice mt-4">{error}</p>}
      {loading ? <p className="student-notice mt-6">Memuat…</p> : kategori.length === 0 && !error ? (
        <p className="student-notice mt-6">Belum ada try out yang selesai dikerjakan.</p>
      ) : (
        <div className="student-kategori-grid">
          {kategori.map((k, i) => {
            const n = jumlah[k.kode] ?? 0;
            const Icon = n > 0 ? ClipboardList : Lock;
            const inner = (
              <>
                <span className="student-kategori-icon"><Icon size={24} aria-hidden="true" /></span>
                <span className="student-kategori-text">
                  <strong>{k.nama}</strong>
                  <small>{n > 0 ? `${n} try out selesai` : "Belum ada riwayat pada kategori ini"}</small>
                </span>
                <span className="student-kategori-foot">
                  {n > 0 ? <><em>Buka</em><ArrowRight size={16} aria-hidden="true" /></> : <em>Kosong</em>}
                </span>
              </>
            );
            return n > 0
              ? <Link key={k.kode} href={`/siswa/riwayat/tryout/${encodeURIComponent(k.kode)}`} className="student-kategori" style={{ "--kat": WARNA_KATEGORI[i % WARNA_KATEGORI.length] } as CSSProperties}>{inner}</Link>
              : <div key={k.kode} className="student-kategori student-kategori-off" aria-disabled="true">{inner}</div>;
          })}
        </div>
      )}
    </main>
  );
}
