"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Paging daftar riwayat siswa. `resetKey` (mis. kata pencarian) mengembalikan ke halaman 1.
export const RIWAYAT_PER_HALAMAN = 12;

export function useHalaman<T>(items: T[], resetKey: unknown, perHalaman = RIWAYAT_PER_HALAMAN) {
  const [halaman, setHalaman] = useState(1);
  useEffect(() => setHalaman(1), [resetKey]);
  const jumlahHalaman = Math.max(1, Math.ceil(items.length / perHalaman));
  const aktif = Math.min(halaman, jumlahHalaman);
  const mulai = (aktif - 1) * perHalaman;
  return {
    halaman: aktif,
    jumlahHalaman,
    setHalaman,
    tampil: items.slice(mulai, mulai + perHalaman),
    dari: items.length ? mulai + 1 : 0,
    sampai: Math.min(mulai + perHalaman, items.length),
    total: items.length,
  };
}

// Ambil data per item (mis. ringkasan benar/salah) hanya untuk item yang sedang tampil; hasil di-cache.
export function useDataPerItem<V>(ids: number[], ambil: (id: number) => Promise<V | null>) {
  const [data, setData] = useState<Record<number, V | null>>({});
  const diminta = useRef(new Set<number>());
  const ambilRef = useRef(ambil);
  ambilRef.current = ambil;
  const mounted = useRef(true);
  const kunci = ids.join(",");

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const baru = ids.filter((id) => !diminta.current.has(id));
    if (baru.length === 0) return;
    baru.forEach((id) => diminta.current.add(id));
    // Hasil tetap disimpan walau siswa sudah pindah halaman, supaya tidak diambil ulang.
    Promise.all(baru.map(async (id) => [id, await ambilRef.current(id).catch(() => null)] as const)).then((entries) => {
      if (mounted.current) setData((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);

  return data;
}

type Props = {
  halaman: number;
  jumlahHalaman: number;
  dari: number;
  sampai: number;
  total: number;
  onGanti: (halaman: number) => void;
};

export default function RiwayatPaging({ halaman, jumlahHalaman, dari, sampai, total, onGanti }: Props) {
  if (jumlahHalaman <= 1) return null;
  const ganti = (next: number) => {
    onGanti(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <nav className="student-paging" aria-label="Halaman riwayat">
      <p role="status">{dari}–{sampai} dari {total}</p>
      <div className="student-paging-actions">
        <button type="button" className="student-btn student-btn-outline" disabled={halaman === 1} onClick={() => ganti(halaman - 1)}>
          <ChevronLeft size={15} aria-hidden="true" /> Sebelumnya
        </button>
        <span>{halaman} / {jumlahHalaman}</span>
        <button type="button" className="student-btn student-btn-outline" disabled={halaman === jumlahHalaman} onClick={() => ganti(halaman + 1)}>
          Berikutnya <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
