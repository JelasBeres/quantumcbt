"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, FileText, Search } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { formatWaktuJadwal } from "@/lib/waktu-jadwal";

// Langkah 2: daftar card paket pada kategori terpilih. Klik card baru menampilkan rincian mapel (mengikuti alur admin).
type Bagian = { bagian_id: number; nama: string; jumlah_soal?: number; pelajaran_id?: number | null };
type LatihanRaw = { id: number; kategori?: string | null; nama: string; deskripsi?: string | null; durasi_menit: number; jumlah_soal: number; kategori_nama?: string | null; bagian?: Bagian[] };
type JadwalRaw = { kategori?: string | null; jadwal_ujian_id: number; paket_ujian_id: number; nama_paket: string; mulai: string; selesai: string; status: "mendatang" | "berlangsung" | "berakhir"; durasi_menit?: number; jumlah_soal?: number; tipe?: string; kategori_nama?: string | null; deskripsi_paket?: string | null; bagian?: Bagian[]; izinkan_pilih_mapel?: boolean };
type RiwayatRaw = { ujian_siswa_id: number; jadwal_ujian_id?: number | null; is_submitted: boolean };

type PaketCard = {
  id: number;
  nama: string;
  keterangan?: string | null;
  jumlahSoal: number;
  jumlahMapel: number;
  jumlahSet: number;
  durasi: number;
  status?: "mendatang" | "berlangsung" | "berakhir";
  selesai?: boolean;
  mulai?: string;
  tutup?: string;
  izinkanPilihMapel?: boolean;
  href: string;
};

// Satu mapel bisa punya beberapa set (Matematika 1, Matematika 2), jadi mapel dihitung unik.
function hitungBagian(bagian?: Bagian[]) {
  const list = bagian ?? [];
  const mapel = new Set(list.map((b) => b.pelajaran_id ?? `bagian-${b.bagian_id}`));
  return { jumlahMapel: Math.max(mapel.size, 1), jumlahSet: Math.max(list.length, 1) };
}

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
  const [cari, setCari] = useState("");

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
            ...hitungBagian(p.bagian),
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
            keterangan: j.deskripsi_paket,
            jumlahSoal: j.jumlah_soal || 0,
            ...hitungBagian(j.bagian),
            durasi: j.durasi_menit ?? 0,
            status: j.status,
            selesai: selesaiSet.has(j.jadwal_ujian_id),
            mulai: j.mulai,
            tutup: j.selesai,
            izinkanPilihMapel: j.izinkan_pilih_mapel !== false,
            href: `/siswa/paket/${j.jadwal_ujian_id}?kategori=${encodeURIComponent(kategori)}${j.izinkan_pilih_mapel === false ? "&mulai=1" : ""}`,
          })));
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, isLatihan ? "Latihan gagal dimuat." : "Try Out gagal dimuat."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLatihan, kategori]);

  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return items;
    return items.filter((item) => `${item.nama} ${item.keterangan ?? ""}`.toLowerCase().includes(kata));
  }, [items, cari]);

  const judul = isLatihan ? "Latihan" : "Try Out";
  const base = isLatihan ? "/siswa/latihan" : "/siswa/tryout";
  const labelKategori = namaKategori || (kategori === "lainnya" ? "Lainnya" : kategori.replace(/_/g, " ").toUpperCase());

  return (
    <main className="student-home student-split-page">
      <Link href={base} className="student-back"><ArrowLeft size={15} aria-hidden="true" /> Kategori {judul}</Link>
      <header className="student-split-head">
        <h1>{judul} {labelKategori}</h1>
      </header>

      {error && <p role="alert" className="student-notice mb-4">{error}</p>}

      {!loading && items.length > 0 && (
        <label className="student-search mt-5">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari ${judul.toLowerCase()}...`}
            aria-label={`Cari ${judul.toLowerCase()}`}
          />
        </label>
      )}

      {loading ? <p className="student-notice mt-6">Memuat…</p> : items.length === 0 ? (
        <p className="student-notice mt-6">{isLatihan ? "Belum ada latihan pada kategori ini." : "Belum ada try out pada kategori ini."}</p>
      ) : hasilCari.length === 0 ? (
        <p className="student-notice mt-6">Tidak ada {judul.toLowerCase()} yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
      ) : (
        <div className="student-tryouts student-list-compact">
          {hasilCari.map((item) => (
            <article key={item.id} className="student-tryout">
              <div className="student-tryout-cover">
                <div className="student-tryout-top">
                  <span className="student-pill">
                    {item.jumlahMapel} mapel{item.jumlahSet > item.jumlahMapel ? ` · ${item.jumlahSet} set` : ""}
                  </span>
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
                {!isLatihan && !item.selesai && item.tutup && (
                  <p className="student-muted mb-3 text-xs">
                    {item.status === "mendatang" && item.mulai && <>Dibuka {formatWaktuJadwal(item.mulai)}<br /></>}
                    Ditutup <strong>{formatWaktuJadwal(item.tutup)}</strong>
                  </p>
                )}
                <Link className="student-primary-link" href={item.href}>
                  {!isLatihan && item.izinkanPilihMapel === false ? "Mulai Ujian" : "Kerjakan Set Soal"} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
