"use client";
import LatihanList from "@/components/LatihanList";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardList, Clock3, FileText, Sparkles, CalendarClock, Award, CheckCircle2, History, User, Play } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Skeleton from "@/components/Skeleton";

type SiswaDashboard = {
  siswa: {
    nama_lengkap: string;
    no_induk?: string | null;
  };
  jadwal_mendatang: number;
  ujian_aktif: number;
  riwayat_ujian: number;
  hasil_terakhir?: number | null;
  program_name?: string | null;
  kelas_name?: string | null;
};

type Riwayat = {
  ujian_siswa_id: number;
  jadwal_ujian_id?: number | null;
  nama_paket: string;
  started_at?: string | null;
  is_submitted: boolean;
  nama_grup_tryout?: string | null;
  skor?: number | null;
};

type Jadwal = {
  jadwal_ujian_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  mulai: string;
  selesai: string;
  status: "mendatang" | "berlangsung" | "berakhir";
  grup_tryout_id?: number | null;
  nama_grup_tryout?: string | null;
  durasi_menit?: number;
  jumlah_soal?: number;
  pelajaran?: string | null;
  tipe?: "ujian" | "latihan";
};

function formatDurasi(menit: number): string {
  if (!menit) return "-";
  if (menit < 60) return `${menit} Menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa > 0 ? `${jam} Jam ${sisa} Menit` : `${jam} Jam`;
}

function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export default function SiswaHomePage() {
  const router = useRouter();
  const [data, setData] = useState<SiswaDashboard | null>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTipe, setActiveTipe] = useState<"ujian" | "latihan">("ujian");

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "siswa") {
      router.replace("/admin/dashboard");
      return;
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dashboardRes, riwayatRes, jadwalRes] = await Promise.all([
          api.get("/siswa/dashboard"),
          api.get("/siswa/riwayat-ujian"),
          api.get("/siswa/jadwal-ujian")
        ]);
        if (cancelled) return;
        setData(dashboardRes.data);
        setRiwayat(riwayatRes.data ?? []);
        setJadwal(jadwalRes.data ?? []);
      } catch (err: any) {
        if (!cancelled) setError(getErrorMessage(err, "Gagal memuat beranda."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ujian yang sedang dikerjakan (belum submit) dari riwayat
  const sedangDikerjakan = riwayat.filter((r) => !r.is_submitted);

  // Ujian tersedia: jadwal berlangsung/mendatang, difilter berdasarkan tipe paket aktif
  const jadwalTersedia = jadwal.filter((j) => {
    if (j.status !== "berlangsung" && j.status !== "mendatang") return false;
    return j.tipe === activeTipe;
  });

  const riwayatSelesaiByJadwal = new Map(
    riwayat
      .filter((item) => item.is_submitted && item.jadwal_ujian_id != null)
      .map((item) => [item.jadwal_ujian_id as number, item.ujian_siswa_id])
  );
  const jadwalSelesaiSet = new Set(riwayatSelesaiByJadwal.keys());

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
      </div>
    );
  }

  const nama = data?.siswa?.nama_lengkap ?? "";

  const ujianSelesai = riwayat.filter((r) => r.is_submitted);
  const skorTerkumpul = ujianSelesai
    .map((r) => r.skor)
    .filter((s): s is number => s != null);
  const rataRata = skorTerkumpul.length > 0
    ? skorTerkumpul.reduce((a, b) => a + b, 0) / skorTerkumpul.length
    : null;

  const stats = [
    { label: "Rata-rata Nilai", value: rataRata != null ? rataRata.toFixed(1) : "-", icon: Award },
    { label: "Ujian Selesai", value: String(ujianSelesai.length), icon: CheckCircle2 },
    { label: "Skor Terakhir", value: data?.hasil_terakhir != null ? data.hasil_terakhir.toFixed(1) : "-", icon: Sparkles }
  ];

  return (
    <main className="student-home">
      <section className="student-hero">
        <p className="student-eyebrow">QUANTUM RESEARCH · RUANG BELAJARMU</p>
        <h1>Siap selangkah lebih maju?</h1>
        <p>Halo, {nama || "teman Quantum"}. Mulai latihan, raih targetmu.<br />
          {[data?.program_name, data?.kelas_name].filter(Boolean).join(" · ")}
        </p>
      </section>

      <nav className="student-categories" aria-label="Menu belajar">
        <button type="button" className="student-category" aria-pressed={activeTipe === "ujian"} onClick={() => setActiveTipe("ujian")}>
          <span className="student-category-icon"><ClipboardList size={25} aria-hidden="true" /></span>Tryout
        </button>
        <button type="button" className="student-category" aria-pressed={activeTipe === "latihan"} onClick={() => setActiveTipe("latihan")}>
          <span className="student-category-icon"><BookOpen size={25} aria-hidden="true" /></span>Latihan
        </button>
        {[
          { href: "/siswa/jadwal-ujian", label: "Jadwal", icon: CalendarClock },
          { href: "/siswa/ujian-aktif", label: "Ujian Aktif", icon: Play },
          { href: "/siswa/riwayat", label: "Riwayat", icon: History },
          { href: "/siswa/profil", label: "Profil Saya", icon: User }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="student-category">
            <span className="student-category-icon"><item.icon size={25} aria-hidden="true" /></span>{item.label}
          </Link>
        ))}
      </nav>

      {error && <p role="alert" className="student-notice">{error}</p>}

      {sedangDikerjakan.length > 0 && (
        <section className="student-section" aria-label="Lanjutkan pengerjaan">
          {sedangDikerjakan.map((item) => (
            <div key={item.ujian_siswa_id} className="student-notice mb-3 flex flex-wrap items-center justify-between gap-4">
              <div><p className="student-eyebrow">LANJUTKAN PERJALANANMU</p>
                <h2 className="mt-2 font-bold">{item.nama_paket}</h2>
                <p className="student-muted">Mulai {formatTanggal(item.started_at)}</p>
              </div>
              <Link className="student-primary-link" href={`/siswa/ujian/${item.ujian_siswa_id}`}>Lanjutkan <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ))}
        </section>
      )}

      {activeTipe === "latihan" ? <section className="student-section"><LatihanList /></section> : (
        <section className="student-section" aria-labelledby="tryout-heading">
          <div className="student-section-heading">
            <div><p className="student-eyebrow">SIMULASI UJIAN</p><h2 id="tryout-heading">Tryout Terbaru</h2>
              <p className="student-muted">Ukur kemampuanmu, siapkan langkah berikutnya.</p>
            </div>
            <Link className="student-outline-link" href="/siswa/jadwal-ujian">Semua <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
          {jadwalTersedia.length === 0 ? (
            <div className="student-notice">Belum ada Tryout tersedia. Sambil menunggu jadwal, yuk buka menu Latihan.</div>
          ) : (
            <div className="student-tryouts">
              {[...jadwalTersedia].sort((a, b) => b.jadwal_ujian_id - a.jadwal_ujian_id).map((item) => {
                const selesai = jadwalSelesaiSet.has(item.jadwal_ujian_id);
                return (
                  <article key={item.jadwal_ujian_id} className="student-tryout">
                    <div className="student-tryout-cover">
                      <span className="student-pill">{selesai ? "Sudah dikerjakan" : item.status === "berlangsung" ? "Sedang berlangsung" : "Segera hadir"}</span>
                      <h3>{item.nama_paket}</h3>
                      <p className="mt-2 text-xs text-white/80">{item.nama_grup_tryout || item.pelajaran || "Quantum Research"}</p>
                    </div>
                    <div className="student-tryout-body">
                      <div className="student-meta">
                        <span><FileText size={15} aria-hidden="true" />{item.jumlah_soal ?? "-"} soal</span>
                        <span><Clock3 size={15} aria-hidden="true" />{formatDurasi(item.durasi_menit ?? 0)}</span>
                      </div>
                      <p className="student-muted mb-4">Mulai {formatTanggal(item.mulai)}</p>
                      {selesai ? (
                        <Link className="student-primary-link" href={`/siswa/hasil/${riwayatSelesaiByJadwal.get(item.jadwal_ujian_id)}`}>Lihat Hasil <ArrowRight size={15} aria-hidden="true" /></Link>
                      ) : item.status === "berlangsung" ? (
                        <Link className="student-primary-link" href={`/siswa/paket/${item.jadwal_ujian_id}`}>Mulai Tryout <ArrowRight size={15} aria-hidden="true" /></Link>
                      ) : <p className="student-notice text-center">Dibuka sesuai jadwal</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="student-section" aria-labelledby="progress-heading">
        <div className="student-section-heading">
          <div><p className="student-eyebrow">SETIAP LANGKAH BERARTI</p><h2 id="progress-heading">Progres Belajarmu</h2></div>
          <Link href="/siswa/riwayat" className="student-outline-link">Riwayat <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="student-stat-grid">
          {stats.map((stat) => (
            <div className="student-stat" key={stat.label}>
              <stat.icon size={20} className="text-violet-300" aria-hidden="true" />
              <strong>{stat.value}</strong><p className="student-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}