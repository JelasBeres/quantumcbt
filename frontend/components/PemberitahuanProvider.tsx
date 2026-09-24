"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Megaphone, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { JENIS_LABEL, PemberitahuanSiswa, isTautanLuar } from "@/lib/pemberitahuan";

type PemberitahuanState = {
  items: PemberitahuanSiswa[];
  belumDibaca: number;
  loaded: boolean;
  refresh: () => Promise<void>;
  tandaiDibaca: (id: number) => Promise<void>;
  bacaSemua: () => Promise<void>;
  buka: (item: PemberitahuanSiswa) => void;
};

const PemberitahuanContext = createContext<PemberitahuanState | null>(null);

export function usePemberitahuan() {
  const ctx = useContext(PemberitahuanContext);
  if (!ctx) throw new Error("usePemberitahuan harus dipakai di dalam PemberitahuanProvider");
  return ctx;
}

// Muat ulang paling sering sekali per interval ini saat siswa berpindah halaman.
const JEDA_REFRESH_MS = 30_000;
const MAKS_POPUP = 5;

export function JenisIcon({ jenis, size = 18 }: { jenis: PemberitahuanSiswa["jenis"]; size?: number }) {
  const Icon = jenis === "promo" ? Megaphone : jenis === "paket_baru" ? Sparkles : Bell;
  return <Icon size={size} aria-hidden="true" />;
}

export default function PemberitahuanProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<PemberitahuanSiswa[]>([]);
  const [belumDibaca, setBelumDibaca] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [popupIds, setPopupIds] = useState<number[] | null>(null);
  const lastFetch = useRef(0);
  const itemsRef = useRef<PemberitahuanSiswa[]>([]);

  const refresh = useCallback(async () => {
    lastFetch.current = Date.now();
    try {
      const { data } = await api.get<{ belum_dibaca: number; items: PemberitahuanSiswa[] }>("/pemberitahuan/saya");
      itemsRef.current = data.items;
      setItems(data.items);
      setBelumDibaca(data.belum_dibaca);
      setLoaded(true);
      // Popup hanya disusun sekali per sesi halaman: pemberitahuan baru yang
      // belum dibaca & ditandai tampil popup.
      setPopupIds((current) => current ?? data.items.filter((i) => !i.dibaca && i.tampil_popup).slice(0, MAKS_POPUP).map((i) => i.id));
    } catch {
      // Diam saja: pemberitahuan tidak boleh mengganggu halaman lain.
    }
  }, []);

  useEffect(() => {
    if (Date.now() - lastFetch.current >= JEDA_REFRESH_MS) void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onFocus = () => { if (Date.now() - lastFetch.current >= JEDA_REFRESH_MS) void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const tandaiDibaca = useCallback(async (id: number) => {
    const target = itemsRef.current.find((i) => i.id === id);
    if (!target || target.dibaca) return;
    itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, dibaca: true } : i));
    setItems(itemsRef.current);
    setBelumDibaca((n) => Math.max(0, n - 1));
    try {
      await api.post(`/pemberitahuan/${id}/baca`);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const bacaSemua = useCallback(async () => {
    itemsRef.current = itemsRef.current.map((i) => ({ ...i, dibaca: true }));
    setItems(itemsRef.current);
    setBelumDibaca(0);
    try {
      await api.post("/pemberitahuan/baca-semua");
    } catch {
      void refresh();
    }
  }, [refresh]);

  const buka = useCallback((item: PemberitahuanSiswa) => {
    void tandaiDibaca(item.id);
    if (!item.tautan) return;
    if (isTautanLuar(item.tautan)) window.open(item.tautan, "_blank", "noopener,noreferrer");
    else router.push(item.tautan);
  }, [router, tandaiDibaca]);

  const value = useMemo(
    () => ({ items, belumDibaca, loaded, refresh, tandaiDibaca, bacaSemua, buka }),
    [items, belumDibaca, loaded, refresh, tandaiDibaca, bacaSemua, buka],
  );

  const antrean = (popupIds ?? [])
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is PemberitahuanSiswa => !!i && !i.dibaca);
  const popup = pathname.startsWith("/siswa/pemberitahuan") ? undefined : antrean[0];
  const tutupPopup = (item: PemberitahuanSiswa) => {
    void tandaiDibaca(item.id);
  };
  const tutupSemua = () => {
    const ids = antrean.map((i) => i.id);
    setPopupIds([]);
    ids.forEach((id) => void tandaiDibaca(id));
  };

  useEffect(() => {
    if (!popup) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") void tandaiDibaca(popup.id); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popup, tandaiDibaca]);

  return (
    <PemberitahuanContext.Provider value={value}>
      {children}
      {popup && (
        <div className="student-notif-overlay" role="dialog" aria-modal="true" aria-labelledby="student-notif-popup-title">
          <div className={`student-notif-popup student-notif-${popup.jenis}`}>
            <button type="button" className="student-notif-close" aria-label="Tutup" onClick={() => tutupPopup(popup)}><X size={18} /></button>
            <span className="student-notif-badge"><JenisIcon jenis={popup.jenis} size={14} /> {JENIS_LABEL[popup.jenis] ?? "Info"}</span>
            <h2 id="student-notif-popup-title">{popup.judul}</h2>
            {popup.isi && <p className="student-notif-popup-isi">{popup.isi}</p>}
            <div className="student-notif-popup-actions">
              {popup.tautan && <button type="button" className="student-primary-link" onClick={() => buka(popup)}>Lihat Sekarang</button>}
              <button type="button" className="student-notif-secondary" onClick={() => tutupPopup(popup)}>{popup.tautan ? "Nanti Saja" : "Mengerti"}</button>
            </div>
            {antrean.length > 1 && (
              <p className="student-notif-popup-foot">
                {antrean.length - 1} pemberitahuan lain menunggu ·{" "}
                <button type="button" onClick={tutupSemua}>Tutup semua</button>
              </p>
            )}
          </div>
        </div>
      )}
    </PemberitahuanContext.Provider>
  );
}
