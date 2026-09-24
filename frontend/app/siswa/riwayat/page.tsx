"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { fetchRiwayatLatihan, fetchRiwayatTryout } from "@/lib/riwayat";

// Riwayat dipisah dua grup sebelum memilih kategori: Tryout dan Latihan.
export default function RiwayatPage() {
  const [jumlah, setJumlah] = useState<{ tryout: number; latihan: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tryout, latihan] = await Promise.all([fetchRiwayatTryout(), fetchRiwayatLatihan()]);
        if (!cancelled) setJumlah({ tryout: tryout.length, latihan: latihan.length });
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Riwayat gagal dimuat."));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grup = [
    { href: "/siswa/riwayat/tryout", judul: "Tryout", icon: ClipboardList, info: jumlah ? `${jumlah.tryout} tryout selesai` : "Memuat…" },
    { href: "/siswa/riwayat/latihan", judul: "Latihan", icon: BookOpen, info: jumlah ? `${jumlah.latihan} sesi latihan selesai` : "Memuat…" },
  ];

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/dashboard" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Beranda</Link>
      <header className="student-split-head">
        <h1>Riwayat</h1>
        <p className="student-muted mt-1">Pilih riwayat tryout atau latihan yang sudah kamu kerjakan.</p>
      </header>

      {error && <p role="alert" className="student-notice mt-4">{error}</p>}

      <nav className="student-categories student-riwayat-grup" aria-label="Grup riwayat">
        {grup.map(({ href, judul, icon: Icon, info }) => (
          <Link key={href} href={href} className="student-category">
            <span className="student-category-icon"><Icon size={24} aria-hidden="true" /></span>
            <span className="student-category-text"><strong>{judul}</strong><small>{info}</small></span>
            <ArrowRight size={18} className="student-category-arrow" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </main>
  );
}
