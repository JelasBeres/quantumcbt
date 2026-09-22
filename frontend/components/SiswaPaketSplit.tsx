"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, FileText } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";

// Langkah 2: daftar card paket pada kategori terpilih. Klik card baru menampilkan rincian mapel (mengikuti alur admin).
type Bagian = { bagian_id: number; nama: string; jumlah_soal?: number };
type LatihanRaw = { id: number; kategori?: string | null; nama: string; deskripsi?: string | null; durasi_menit: number; jumlah_soal: number; kategori_nama?: string | null; bagian?: Bagian[] };
type JadwalRaw = { kategori?: string | null; jadwal_ujian_id: number; paket_ujian_id: number; nama_paket: string; mulai: string; selesai: string; status: "mendatang" | "berlangsung" | "berakhir"; durasi_menit?: number; jumlah_soal?: number; tipe?: string; nama_grup_tryout?: string | null; kategori_nama?: string | null; deskripsi_paket?: string | null; bagian?: Bagian[]; izinkan_pilih_mapel?: boolean };
type RiwayatRaw = { ujian_siswa_id: number; jadwal_ujian_id?: number | null; is_submitted: boolean };

type PaketCard = {
  id: number;
  nama: string;
  keterangan?: string | null;
  jumlahSoal: number;
  jumlahBagian: number;
  durasi: number;
  status?: "mendatang" | "berlangsung" | "berakhir";
  selesai?: boolean;
  izinkanPilihMapel?: boolean;
  href: string;
};

function formatDurasi(menit: number) {
  if (!menit) return "-";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60), sisa = menit % 60;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

export default function SiswaPaketSplit({ tipe, kategori }: { tipe: "latihan" | "ujian"; kategori: string }) {
  const isLatihan = tipe === "latihan";
  const [items, setItems] = useState<PaketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [namaKategori, setNamaKategori] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isLatihan) {
          const { data } = await api.get<LatihanRaw[]>("/siswa/latihan");
          if (cancelled) return;
          const cocok = (data ?? []).filter((p) => (p.kategori || "lainnya") === kategori);
          setNamaKategori(cocok[0]?.kategori_nama || "");
          setItems(cocok.map((p) => ({
            id: p.id,
            nama: p.nama,
            keterangan: p.deskripsi,
            jumlahSoal: p.jumlah_soal,
            jumlahBagian: p.bagian?.length || 1,
            durasi: p.durasi_menit,
            href: `/siswa/latihan/${encodeURIComponent(kategori)}/${p.id}`,
          })));
        } else {
          const [jadwalRes, riwayatRes] = await Promise.all([api.get<JadwalRaw[]>("/siswa/jadwal-tersedia"), api.get<RiwayatRaw[]>("/siswa/riwayat-ujian")]);
          if (cancelled) return;
          const selesaiSet = new Set((riwayatRes.data ?? []).filter((r) => r.is_submitted && r.jadwal_ujian_id != null).map((r) => r.jadwal_ujian_id as number));
          const cocok = (jadwalRes.data ?? []).filter((j) => j.tipe === "ujian" && j.status !== "berakhir" && (j.kategori || "lainnya") === kategori);
          setNamaKategori(cocok[0]?.kategori_nama || "");
          setItems(cocok.map((j) => ({
            id: j.jadwal_ujian_id,
            nama: j.nama_paket,
            keterangan: j.nama_grup_tryout || j.deskripsi_paket,
            jumlahSoal: j.jumlah_soal || 0,
            jumlahBagian: j.bagian?.length || 1,
            durasi: j.durasi_menit ?? 0,
            status: j.status,
            selesai: selesaiSet.has(j.jadwal_ujian_id),
            izinkanPilihMapel: j.izinkan_pilih_mapel !== false,
            href: `/siswa/paket/${j.jadwal_ujian_id}?kategori=${encodeURIComponent(kategori)}`,
          })));
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, isLatihan ? "Latihan gagal dimuat." : "Tryout gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLatihan, kategori]);

  const judul = isLatihan ? "Latihan" : "Tryout";
  const base = isLatihan ? "/siswa/latihan" : "/siswa/tryout";
  const labelKategori = namaKategori || (kategori === "lainnya" ? "Lainnya" : kategori.replace(/_/g, " ").toUpperCase());

  return (
    <main className="student-home student-split-page">
      <Link href={base} className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Kategori {judul}</Link>
      <header className="student-split-head">
        <h1>{judul} {labelKategori}</h1>
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : items.length === 0 ? (
        <p className="student-notice mt-6">{isLatihan ? "Belum ada latihan pada kategori ini." : "Belum ada tryout pada kategori ini."}</p>
      ) : (
        <div className="student-tryouts mt-6">
          {items.map((item) => (
            <article key={item.id} className="student-tryout">
              <div className="student-tryout-cover">
                <div className="student-tryout-top">
                  <span className="student-pill">{item.jumlahBagian} mapel</span>
                  {!isLatihan && (
                    <span className={`student-pill ${item.selesai ? "student-pill-muted" : item.status === "berlangsung" ? "student-pill-green" : "student-pill-amber"}`}>
                      {item.selesai ? "Selesai" : item.status === "berlangsung" ? "Berlangsung" : "Segera"}
                    </span>
                  )}
                </div>
                <div>
                  <h3>{item.nama}</h3>
                  {item.keterangan && <p className="student-tryout-sub">{item.keterangan}</p>}
                </div>
              </div>
              <div className="student-tryout-body">
                <div className="student-meta">
                  <span><FileText size={15} aria-hidden="true" />{item.jumlahSoal} soal</span>
                  <span><Clock3 size={15} aria-hidden="true" />{formatDurasi(item.durasi)}</span>
                </div>
                <Link className="student-primary-link" href={item.href}>
                  {!isLatihan && item.izinkanPilihMapel === false ? "Mulai Ujian" : "Lihat Mapel"} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
