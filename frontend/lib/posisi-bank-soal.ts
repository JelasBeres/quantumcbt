// Posisi drill-down Bank Soal (tipe → kelas → mapel → bab → subbab) disimpan per tab
// supaya kembali dari form Tambah/Edit Soal tidak mengulang dari awal.
import { useEffect, useRef } from "react";

type AppRouter = { back: () => void; push: (href: string) => void };

export function useIngatPosisi<T extends object>(key: string, posisi: T, pulihkan: (tersimpan: Partial<T>) => void) {
  const siap = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) pulihkan(JSON.parse(raw));
    } catch {
      // sessionStorage tidak tersedia: mulai dari awal saja.
    }
    siap.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const serial = JSON.stringify(posisi);
  useEffect(() => {
    if (!siap.current) return;
    try {
      sessionStorage.setItem(key, serial);
    } catch {
      // abaikan
    }
  }, [key, serial]);
}

// Kembali ke halaman sebelumnya di aplikasi; kalau form dibuka langsung (tab baru), ke fallback.
export function kembaliAtau(router: AppRouter, fallback: string) {
  if (typeof window !== "undefined" && window.history.length > 1) router.back();
  else router.push(fallback);
}
