"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardList, Clock3, FileText, Sparkles, CalendarClock, Award, CheckCircle2, History, User, Play, Calculator, Languages, BookText, Atom, FlaskConical, Leaf, Globe, Landmark, Wallet, Users, Brain, GraduationCap, Sunrise, Sun, Sunset, Moon } from "lucide-react";

function salamWaktu() {
  const jam = new Date().getHours();
  if (jam >= 4 && jam < 11) return { label: "Pagi", Icon: Sunrise };
  if (jam >= 11 && jam < 15) return { label: "Siang", Icon: Sun };
  if (jam >= 15 && jam < 18) return { label: "Sore", Icon: Sunset };
  return { label: "Malam", Icon: Moon };
}
import { api, getErrorMessage } from "@/lib/api";
import { formatNilai, RENTANG_SKALA, ringkasPerSkala, skalaNilai, SkalaNilai } from "@/lib/skala-nilai";
import { getUser } from "@/lib/auth";
import Skeleton from "@/components/Skeleton";
import { formatWaktuJadwal } from "@/lib/waktu-jadwal";
import { kategoriKey } from "@/lib/riwayat";

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
  kategori?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  is_submitted: boolean;
  skor?: number | null;
  metode_penilaian?: string | null;
  skala?: string | null;
  kohort_status?: string | null;
  nilai_ditahan?: boolean;
};

type RiwayatLatihan = {
  ujian_siswa_id: number;
  nama_paket: string;
  kategori?: string | null;
  pelajaran_nama?: string | null;
  finished_at?: string | null;
  skor?: number | null;
};

const rataRataSkor = (items: Array<{ skor?: number | null }>) => {
  const skor = items.map((item) => item.skor).filter((value): value is number => value != null);
  return skor.length ? { rata: skor.reduce((a, b) => a + b, 0) / skor.length, tertinggi: Math.max(...skor), jumlah: skor.length } : null;
};

const waktuMs = (value?: string | null) => {
  if (!value) return 0;
  const time = new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`).getTime();
  return Number.isFinite(time) ? time : 0;
};

function subjectIcon(pelajaran?: string | null) {
  const n = (pelajaran || "").toLowerCase();
  if (n.includes("matemati") || n.includes("kuantitatif")) return Calculator;
  if (n.includes("inggris")) return Languages;
  if (n.includes("bacaan") || n.includes("menulis") || n.includes("indonesia")) return BookText;
  if (n.includes("fisika")) return Atom;
  if (n.includes("kimia")) return FlaskConical;
  if (n.includes("biologi")) return Leaf;
  if (n.includes("geografi")) return Globe;
  if (n.includes("sejarah")) return Landmark;
  if (n.includes("ekonomi")) return Wallet;
  if (n.includes("sosiologi")) return Users;
  if (n.includes("penalaran") || n.includes("umum")) return Brain;
  return GraduationCap;
}

type Jadwal = {
  jadwal_ujian_id: number;
  paket_ujian_id: number;
  nama_paket: string;
  mulai: string;
  selesai: string;
  status: "mendatang" | "berlangsung" | "berakhir";
  durasi_menit?: number;
  jumlah_soal?: number;
  pelajaran?: string | null;
  tipe?: "ujian" | "latihan";
  izinkan_pilih_mapel?: boolean;
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
  const [riwayatLatihan, setRiwayatLatihan] = useState<RiwayatLatihan[]>([]);
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeTipe = "ujian";

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
        const [dashboardRes, riwayatRes, jadwalRes, latihanRes] = await Promise.all([
          api.get("/siswa/dashboard"),
          api.get("/siswa/riwayat-ujian"),
          api.get("/siswa/jadwal-ujian"),
          // Ringkasan latihan tidak wajib: beranda tetap tampil bila gagal dimuat.
          api.get("/siswa/riwayat-latihan").catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        setRiwayatLatihan(latihanRes.data ?? []);
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
  const { label: waktuLabel, Icon: WaktuIcon } = salamWaktu();

  // Try out = sesi berjadwal; sesi tanpa jadwal dari paket tryout termasuk latihan per-mapel.
  const tryoutSelesai = riwayat.filter((r) => r.is_submitted && r.jadwal_ujian_id != null);
  // Nilai biasa (0–100) dan kohort (TKA 200–800 / UTBK 0–1000) dirata-rata terpisah.
  const statTryoutPerSkala = ringkasPerSkala(tryoutSelesai);
  const statLatihan = rataRataSkor(riwayatLatihan);
  const tryoutBelumDikerjakan = jadwalTersedia.filter((item) => item.status === "berlangsung" && !jadwalSelesaiSet.has(item.jadwal_ujian_id)).length;
  const terakhir = [
    ...tryoutSelesai.map((r) => ({ jenis: "Try Out" as const, nama: r.nama_paket, skor: r.skor, ditahan: !!r.nilai_ditahan, skala: skalaNilai(r), waktu: waktuMs(r.finished_at ?? r.started_at), href: `/siswa/riwayat/tryout/${encodeURIComponent(kategoriKey(r))}/${r.ujian_siswa_id}` })),
    ...riwayatLatihan.map((r) => ({ jenis: "Latihan" as const, nama: r.pelajaran_nama ? `${r.nama_paket} · ${r.pelajaran_nama}` : r.nama_paket, skor: r.skor, ditahan: false, skala: "biasa" as SkalaNilai, waktu: waktuMs(r.finished_at), href: "/siswa/riwayat/latihan" }))
  ].sort((a, b) => b.waktu - a.waktu)[0];
  const fmt = (value: number) => value.toFixed(1);

  const kartuTryout = statTryoutPerSkala.length
    ? statTryoutPerSkala.map((stat) => ({
        label: stat.skala === "biasa" ? "Rata-rata Nilai Try Out" : `Rata-rata Try Out ${stat.skala === "tka" ? "TKA" : "UTBK"}`,
        tag: "Try Out", value: formatNilai(stat.rata, stat.skala), icon: Award, href: "/siswa/riwayat/tryout",
        detail: `${stat.skala === "biasa" ? "" : `Skala ${RENTANG_SKALA[stat.skala]} · `}Dari ${stat.jumlah} try out · tertinggi ${formatNilai(stat.tertinggi, stat.skala)}${stat.adaSementara ? " · ada nilai sementara" : ""}`,
        cta: "Lihat riwayat try out"
      }))
    : [{ label: "Rata-rata Nilai Try Out", tag: "Try Out", value: "-", icon: Award, href: "/siswa/riwayat/tryout", detail: "Belum ada try out yang dinilai", cta: "Lihat riwayat try out" }];

  const stats = [
    ...kartuTryout,
    {
      label: "Rata-rata Nilai Latihan", tag: "Latihan", value: statLatihan ? fmt(statLatihan.rata) : "-", icon: BookOpen, href: "/siswa/riwayat/latihan",
      detail: statLatihan ? `Dari ${statLatihan.jumlah} latihan · tertinggi ${fmt(statLatihan.tertinggi)}` : "Belum ada latihan yang selesai", cta: "Lihat riwayat latihan"
    },
    {
      label: "Try Out Selesai", tag: "Try Out", value: String(tryoutSelesai.length), icon: CheckCircle2, href: tryoutBelumDikerjakan > 0 ? "/siswa/tryout" : "/siswa/riwayat/tryout",
      detail: tryoutBelumDikerjakan > 0 ? `${tryoutBelumDikerjakan} try out sedang dibuka & belum dikerjakan` : `${riwayatLatihan.length} latihan juga sudah diselesaikan`,
      cta: tryoutBelumDikerjakan > 0 ? "Kerjakan sekarang" : "Lihat riwayat"
    },
    {
      label: "Nilai Terakhir", tag: terakhir?.jenis ?? null, value: terakhir?.ditahan ? "Ditahan" : terakhir?.skor != null ? formatNilai(terakhir.skor, terakhir.skala) : "-", icon: Sparkles, href: terakhir?.href ?? "/siswa/riwayat",
      // Nilai try out ditahan server sampai jadwalnya berakhir.
      detail: terakhir?.ditahan ? `${terakhir.nama} · tunggu jadwal try out berakhir` : terakhir ? `${terakhir.nama}${terakhir.skala === "biasa" ? "" : ` · skala ${RENTANG_SKALA[terakhir.skala]}`}` : "Belum ada ujian yang selesai", cta: terakhir ? "Lihat hasil" : "Buka riwayat"
    }
  ];

  return (
    <main>
      <header className="student-hero">
        <GraduationCap className="student-hero-icon" strokeWidth={1.5} aria-hidden="true" />
        <div className="student-hero-inner">
          <span className="student-hero-badge"><WaktuIcon size={13} aria-hidden="true" /> {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1>Selamat {waktuLabel}, {nama || "Siswa"}</h1>
          {[data?.program_name, data?.kelas_name].filter(Boolean).length > 0 && <p>{[data?.program_name, data?.kelas_name].filter(Boolean).join(" · ")}</p>}
        </div>
      </header>

      <div className="student-home">
      <nav className="student-categories" aria-label="Menu belajar">
        <Link href="/siswa/tryout" className="student-category">
          <span className="student-category-icon"><ClipboardList size={24} aria-hidden="true" /></span>
          <span className="student-category-text"><strong>Try Out</strong></span>
          <ArrowRight size={18} className="student-category-arrow" aria-hidden="true" />
        </Link>
        <Link href="/siswa/latihan" className="student-category">
          <span className="student-category-icon"><BookOpen size={24} aria-hidden="true" /></span>
          <span className="student-category-text"><strong>Latihan</strong></span>
          <ArrowRight size={18} className="student-category-arrow" aria-hidden="true" />
        </Link>
      </nav>

      {error && <p role="alert" className="student-notice">{error}</p>}

      {sedangDikerjakan.length > 0 && (
        <section className="student-section" aria-label="Lanjutkan pengerjaan">
          {sedangDikerjakan.map((item) => (
            <div key={item.ujian_siswa_id} className="student-notice mb-3 flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="font-bold">{item.nama_paket}</h2>
                <p className="student-muted">Mulai {formatTanggal(item.started_at)}</p>
              </div>
              <Link className="student-primary-link" href={`/siswa/ujian/${item.ujian_siswa_id}`}>Lanjutkan <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ))}
        </section>
      )}

      {(
        <section className="student-section" aria-labelledby="tryout-heading">
          <div className="student-section-heading">
            <h2 id="tryout-heading">Try Out</h2>
            <Link className="student-outline-link" href="/siswa/tryout">Semua <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
          {jadwalTersedia.length === 0 ? (
            <div className="student-notice">Belum ada try out.</div>
          ) : (
            <div className={`student-tryouts${jadwalTersedia.length === 1 ? " student-tryouts-single" : ""}`}>
              {[...jadwalTersedia].sort((a, b) => b.jadwal_ujian_id - a.jadwal_ujian_id).map((item) => {
                const selesai = jadwalSelesaiSet.has(item.jadwal_ujian_id);
                const SubjectIcon = subjectIcon(item.pelajaran);
                return (
                  <article key={item.jadwal_ujian_id} className="student-tryout">
                    <div className="student-tryout-cover">
                      <SubjectIcon className="student-tryout-icon" strokeWidth={1.5} aria-hidden="true" />
                      <div className="student-tryout-top">
                        {item.pelajaran ? <span className="student-pill">{item.pelajaran}</span> : <span />}
                        <span className={`student-pill ${selesai ? "student-pill-muted" : item.status === "berlangsung" ? "student-pill-green" : "student-pill-amber"}`}>{selesai ? "Selesai" : item.status === "berlangsung" ? "Berlangsung" : "Segera"}</span>
                      </div>
                      <div>
                        <h3>{item.nama_paket}</h3>
                        <p className="student-tryout-sub">Quantum Research</p>
                      </div>
                    </div>
                    <div className="student-tryout-body">
                      <div className="student-meta">
                        <span><FileText size={15} aria-hidden="true" />{item.jumlah_soal ?? "-"} soal</span>
                        <span><Clock3 size={15} aria-hidden="true" />{formatDurasi(item.durasi_menit ?? 0)}</span>
                      </div>
                      <p className="student-muted mb-4">Mulai {formatWaktuJadwal(item.mulai)}<br />Ditutup <strong>{formatWaktuJadwal(item.selesai)}</strong></p>
                      {selesai ? (
                        <Link className="student-primary-link" href={`/siswa/hasil/${riwayatSelesaiByJadwal.get(item.jadwal_ujian_id)}`}>Lihat Hasil <ArrowRight size={15} aria-hidden="true" /></Link>
                      ) : item.status === "berlangsung" ? (
                        <Link className="student-primary-link" href={`/siswa/paket/${item.jadwal_ujian_id}${item.izinkan_pilih_mapel === false ? "?mulai=1" : ""}`}>Mulai Try Out <ArrowRight size={15} aria-hidden="true" /></Link>
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
          <h2 id="progress-heading">Ringkasan</h2>
          <Link href="/siswa/riwayat" className="student-outline-link">Riwayat <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className={`student-stat-grid ${stats.length > 4 ? "student-stat-grid-6" : "student-stat-grid-4"}`}>
          {stats.map((stat) => (
            <Link href={stat.href} className="student-stat" key={stat.label}>
              <span className="student-stat-top">
                <stat.icon size={20} className="text-violet-300" aria-hidden="true" />
                {stat.tag && <span className={`student-stat-tag${stat.tag === "Latihan" ? " student-stat-tag-latihan" : ""}`}>{stat.tag}</span>}
              </span>
              <strong>{stat.value}</strong>
              <span className="student-stat-name">{stat.label}</span>
              <span className="student-stat-detail">{stat.detail}</span>
              <span className="student-stat-link">{stat.cta} <ArrowRight size={12} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>
      </div>
    </main>
  );
}