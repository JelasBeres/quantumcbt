"use client";
import { CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Lock } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";

// Langkah 1: pilih kategori paket (data dari tabel kategori_paket). Jumlah paket dihitung dari paket yang tersedia untuk siswa.
type Kategori = { id: number; kode: string; nama: string; deskripsi?: string | null; tipe: "ujian" | "latihan" | "keduanya"; is_active: boolean };
type PaketRaw = { kategori?: string | null; kategori_nama?: string | null; tipe?: string; status?: string };

export const KATEGORI_LAINNYA = "lainnya";

// Warna kartu kategori yang aktif, bergiliran agar tiap kategori mudah dibedakan.
const WARNA_KATEGORI = ["#2d3c8f", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#0369a1"];

export default function SiswaKategoriPilih({ tipe }: { tipe: "latihan" | "ujian" }) {
  const isLatihan = tipe === "latihan";
  const base = isLatihan ? "/siswa/latihan" : "/siswa/tryout";
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [katRes, paketRes] = await Promise.all([
          api.get<Kategori[]>("/kategori-paket"),
          api.get<PaketRaw[]>(isLatihan ? "/siswa/latihan" : "/siswa/jadwal-tersedia")
        ]);
        if (cancelled) return;
        const count: Record<string, number> = {};
        (paketRes.data ?? [])
          .filter((p) => isLatihan || (p.tipe === "ujian" && p.status !== "berakhir"))
          .forEach((p) => { const k = p.kategori || KATEGORI_LAINNYA; count[k] = (count[k] ?? 0) + 1; });
        setJumlah(count);
        setKategori((katRes.data ?? []).filter((k) => k.is_active && (k.tipe === "keduanya" || k.tipe === tipe)));
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Kategori gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLatihan, tipe]);

  const judul = isLatihan ? "Latihan" : "Try Out";
  const lainnya = jumlah[KATEGORI_LAINNYA] ?? 0;
  const daftar = [
    ...kategori.map((k) => ({ kode: k.kode, nama: k.nama })),
    ...(lainnya > 0 ? [{ kode: KATEGORI_LAINNYA, nama: "Lainnya" }] : [])
  // Kategori yang punya paket tampil paling atas; urutan admin tetap dipakai di dalam tiap kelompok.
  ].sort((a, b) => Number((jumlah[b.kode] ?? 0) > 0) - Number((jumlah[a.kode] ?? 0) > 0));

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/dashboard" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Beranda</Link>
      <header className="student-split-head">
        <h1>{judul}</h1>
      </header>

      {error && <p role="alert" className="student-notice mt-4">{error}</p>}
      {loading ? <p className="student-notice mt-6">Memuat…</p> : daftar.length === 0 && !error ? (
        <p className="student-notice mt-6">Belum ada kategori yang tersedia.</p>
      ) : (
        <div className="student-kategori-grid">
          {daftar.map((k, i) => {
            const n = jumlah[k.kode] ?? 0;
            const Icon = n > 0 ? (isLatihan ? BookOpen : ClipboardList) : Lock;
            const inner = (
              <>
                <span className="student-kategori-icon"><Icon size={24} aria-hidden="true" /></span>
                <span className="student-kategori-text">
                  <strong>{k.nama}</strong>
                  <small>{n > 0 ? `${n} ${isLatihan ? "latihan" : "tryout"} tersedia` : "Belum ada paket pada kategori ini"}</small>
                </span>
                <span className="student-kategori-foot">
                  {n > 0 ? <><em>Buka</em><ArrowRight size={16} aria-hidden="true" /></> : <em>Belum tersedia</em>}
                </span>
              </>
            );
            return n > 0
              ? <Link key={k.kode} href={`${base}/${encodeURIComponent(k.kode)}`} className="student-kategori" style={{ "--kat": WARNA_KATEGORI[i % WARNA_KATEGORI.length] } as CSSProperties}>{inner}</Link>
              : <div key={k.kode} className="student-kategori student-kategori-off" aria-disabled="true">{inner}</div>;
          })}
        </div>
      )}
    </main>
  );
}
