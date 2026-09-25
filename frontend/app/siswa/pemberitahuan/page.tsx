"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCheck, ExternalLink } from "lucide-react";
import { JenisIcon, usePemberitahuan } from "@/components/PemberitahuanProvider";
import { JENIS_LABEL, isTautanLuar, waktuRelatif } from "@/lib/pemberitahuan";

export default function PemberitahuanPage() {
  const { items, belumDibaca, loaded, refresh, bacaSemua, buka, tandaiDibaca } = usePemberitahuan();

  // Selalu ambil data terbaru saat halaman ini dibuka.
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <main className="student-home student-split-page">
      <Link href="/siswa/dashboard" className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Beranda</Link>
      <header className="student-split-head student-notif-head">
        <div>
          <h1>Pemberitahuan</h1>
          <p className="student-muted mt-1">Promo, paket ujian baru, dan info terbaru untukmu.</p>
        </div>
        {belumDibaca > 0 && (
          <button type="button" className="student-notif-secondary" onClick={() => void bacaSemua()}>
            <CheckCheck size={15} aria-hidden="true" /> Tandai semua dibaca
          </button>
        )}
      </header>

      {!loaded ? <p className="student-notice mt-5">Memuat…</p> : items.length === 0 ? (
        <p className="student-notice mt-5">Belum ada pemberitahuan.</p>
      ) : (
        <ul className="student-notif-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`student-notif-item student-notif-${item.jenis}${item.dibaca ? "" : " unread"}`}
                onClick={() => (item.tautan ? buka(item) : void tandaiDibaca(item.id))}
              >
                <span className="student-notif-icon"><JenisIcon jenis={item.jenis} /></span>
                <span className="student-notif-body">
                  <span className="student-notif-meta">
                    <em>{JENIS_LABEL[item.jenis] ?? "Info"}</em>
                    <span>{waktuRelatif(item.created_at)}</span>
                    {!item.dibaca && <span className="student-notif-dot" aria-label="Belum dibaca" />}
                  </span>
                  <strong>{item.judul}</strong>
                  {item.isi && <span className="student-notif-isi">{item.isi}</span>}
                  {item.tautan && (
                    <span className="student-notif-link">
                      {isTautanLuar(item.tautan) ? <>Buka tautan <ExternalLink size={13} aria-hidden="true" /></> : <>Lihat <ArrowRight size={13} aria-hidden="true" /></>}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
