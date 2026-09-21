import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  MonitorSmartphone,
  ShieldCheck,
  Timer,
} from "lucide-react";

const FITUR = [
  { icon: CalendarCheck, title: "Jadwal Otomatis", desc: "Latihan & ujian terjadwal rapi per mata pelajaran." },
  { icon: Timer, title: "Timer Real-time", desc: "Waktu pengerjaan dihitung server, otomatis dikumpulkan." },
  { icon: FileText, title: "Hasil Instan", desc: "Skor otomatis untuk pilihan ganda, koreksi esai terpusat." },
  { icon: ShieldCheck, title: "Autosave Aman", desc: "Jawaban tersimpan otomatis, lanjut kapan saja." },
];

const ALUR = [
  {
    title: "Guru menyusun ujian",
    desc: "Buat bank soal, atur bobot nilai, dan jadwalkan waktu pengerjaan untuk tiap kelas.",
  },
  {
    title: "Siswa login & mengerjakan",
    desc: "Soal tampil satu per satu dengan timer berjalan di server, jadi hasilnya tidak bisa dicurangi lewat jam di perangkat siswa.",
  },
  {
    title: "Nilai keluar otomatis",
    desc: "Pilihan ganda dikoreksi instan, esai masuk ke antrean koreksi guru yang terpusat.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-transparent">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-brand-primary-dark">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28 lg:px-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <Image
                src="/quantum-research-logo.png"
                alt="Logo Quantum Research"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="text-sm font-semibold text-white/80">CBT Quantum Research</span>
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] text-white md:text-5xl">
              Ujian sekolah yang selesai tepat waktu, dinilai tepat angka.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-body-light">
              Satu platform untuk siswa, guru, dan admin mengelola ulangan harian
              sampai ujian akhir — dengan timer yang dihitung server, jawaban
              yang tersimpan otomatis, dan nilai yang keluar begitu siswa selesai.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-btn bg-cta px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cta/30 transition hover:bg-cta-alt"
              >
                Masuk ke akun
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <span className="text-sm text-body-light"></span>
            </div>
          </div>

          {/* Pratinjau ruang ujian, bukan kartu statistik generik */}
          <div className="relative" aria-hidden="true">
            <div className="rounded-modal bg-white p-6 shadow-card">
              <div className="flex items-center justify-between border-b border-card-border pb-4">
                <div>
                  <p className="text-xs font-semibold text-text-muted">Matematika · Ulangan Harian</p>
                  <p className="mt-0.5 text-sm font-bold text-heading-dark">Soal 12 dari 40</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-3 py-1.5 text-sm font-bold tabular-nums text-brand-primary-dark">
                  <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                  24:18
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-heading-dark">
                Turunan pertama dari fungsi f(x) = 3x² − 5x + 2 adalah&hellip;
              </p>

              <div className="mt-4 space-y-2">
                {[
                  { label: "A", text: "6x − 5", active: true },
                  { label: "B", text: "3x − 5", active: false },
                  { label: "C", text: "6x + 2", active: false },
                ].map((o) => (
                  <div
                    key={o.label}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                      o.active
                        ? "border-brand-primary bg-brand-primary/5 font-semibold text-brand-primary-dark"
                        : "border-card-border text-text-muted"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                        o.active ? "border-brand-primary bg-brand-primary text-white" : "border-card-border"
                      }`}
                    >
                      {o.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : o.label}
                    </span>
                    {o.text}
                  </div>
                ))}
              </div>

              <div className="mt-5 h-1.5 w-full rounded-full bg-card-border">
                <div className="h-1.5 w-[30%] rounded-full bg-cta" />
              </div>
            </div>

            <div className="absolute -bottom-5 -left-5 flex items-center gap-2 rounded-modal bg-white px-4 py-3 shadow-card">
              <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <p className="text-xs font-bold text-heading-dark">Tersimpan otomatis</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FITUR ===== */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-heading-dark">Semua kebutuhan CBT dalam satu tempat</h2>
          <p className="mt-3 text-base leading-7 text-text-muted">
            Dari menyusun soal sampai membagikan rapor nilai, tidak perlu berpindah aplikasi.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FITUR.map((f) => (
            <div
              key={f.title}
              className="rounded-card border border-card-border bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-heading-dark">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ALUR KERJA ===== */}
      <section className="bg-cream/70 py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-heading-dark">Bagaimana ujian berjalan</h2>
            <p className="mt-3 text-base leading-7 text-text-muted">
              Tiga langkah, dari soal disusun sampai nilai siap dibagikan.
            </p>
          </div>
          <ol className="mt-10 grid gap-8 lg:grid-cols-3">
            {ALUR.map((step, i) => (
              <li key={step.title} className="relative pl-12">
                <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-base font-bold text-heading-dark">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-modal bg-brand-primary-dark px-8 py-12 sm:flex-row sm:items-center lg:px-12">
          <div className="max-w-lg">
            <p className="flex items-center gap-2 text-sm font-semibold text-cta">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Siap dipakai untuk semester ini
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">
              Masuk dan mulai kelola ujian sekolahmu hari ini.
            </h2>
          </div>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-btn bg-cta px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cta/30 transition hover:bg-cta-alt"
          >
            Masuk sekarang
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-card-border bg-cream/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-center sm:flex-row sm:text-left lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/quantum-research-logo.png"
              alt="Logo Quantum Research"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <p className="text-sm font-bold text-heading-dark">CBT Quantum Research</p>
          </div>
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} Quantum Research. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}