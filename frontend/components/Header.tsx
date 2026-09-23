"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Home, BookOpen, ClipboardList, History, LogOut, KeyRound, LayoutDashboard, FileText, UserCog, CalendarClock, MonitorCheck, Award, AlertTriangle, Activity, Layers, BarChart3, Settings, ShieldCheck } from "lucide-react";

type NavItem = { href: string; label: string; icon: any; match?: string[] };
type AdminGroup = { title: string; items: NavItem[] };

const SISWA_NAV: NavItem[] = [
  { href: "/siswa/dashboard", label: "Beranda", icon: Home, match: ["/siswa/dashboard"] },
  { href: "/siswa/jadwal-ujian", label: "Latihan", icon: BookOpen, match: ["/siswa/jadwal-ujian"] },
  { href: "/siswa/ujian-aktif", label: "Ujian", icon: ClipboardList, match: ["/siswa/ujian-aktif", "/siswa/ujian"] },
  { href: "/siswa/riwayat", label: "Riwayat", icon: History, match: ["/siswa/riwayat", "/siswa/hasil"] },
  { href: "/siswa/profil", label: "Profil", icon: UserCog, match: ["/siswa/profil"] }
];

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", guru: "Guru", siswa: "Siswa" };

function initials(name: string) {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 1)).toUpperCase();
}

const ADMIN_NAV: AdminGroup[] = [
  {
    title: "Beranda",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/admin/dashboard"] }
    ]
  },
  {
    title: "Manajemen Ujian",
    items: [
       { href: "/admin/paket-ujian", label: "Paket Ujian", icon: ClipboardList, match: ["/admin/paket-ujian"] },
       { href: "/admin/kategori-ujian", label: "Kategori Ujian", icon: Layers, match: ["/admin/kategori-ujian"] },

      { href: "/admin/jadwal-ujian", label: "Jadwal Ujian", icon: CalendarClock, match: ["/admin/jadwal-ujian"] },
      { href: "/admin/monitoring-ujian", label: "Monitoring Ujian", icon: MonitorCheck, match: ["/admin/monitoring-ujian"] },
      { href: "/admin/koreksi-esai", label: "Koreksi Jawaban Esai", icon: AlertTriangle, match: ["/admin/koreksi-esai"] }
    ]
  },
  {
    title: "Bank Soal",
    items: [
      { href: "/admin/soal", label: "Bank Soal", icon: FileText, match: ["/admin/soal"] },
      { href: "/admin/tambah-soal", label: "Tambah Soal", icon: ClipboardList, match: ["/admin/tambah-soal"] },
      { href: "/admin/review-soal", label: "Review Soal", icon: ShieldCheck, match: ["/admin/review-soal"] }
    ]
  },
  {
    title: "Penilaian & Pelaporan",
    items: [
      { href: "/admin/rekap-nilai", label: "Rekapitulasi Nilai", icon: Award, match: ["/admin/rekap-nilai"] },
      { href: "/admin/laporan-soal", label: "Analisis Soal", icon: BarChart3, match: ["/admin/laporan-soal"] }
    ]
  },
  {
    title: "Data Akademik",
    items: [
      { href: "/admin/siswa", label: "Data Siswa", icon: UserCog, match: ["/admin/siswa"] },
      { href: "/admin/kelas", label: "Data Kelas", icon: Layers, match: ["/admin/kelas"] },
      { href: "/admin/pelajaran", label: "Data Pelajaran", icon: BookOpen, match: ["/admin/pelajaran"] },
      { href: "/admin/bab-subbab", label: "Bab & Sub Bab", icon: Layers, match: ["/admin/bab-subbab"] },
      { href: "/admin/program", label: "Data Program", icon: Activity, match: ["/admin/program"] }
    ]
  },
  {
    title: "Manajemen Pengguna",
    items: [
      { href: "/admin/users", label: "Data Pengguna", icon: UserCog, match: ["/admin/users"] },
      { href: "/admin/login-activity", label: "Riwayat Aktivitas Login", icon: Activity, match: ["/admin/login-activity"] }
    ]
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, match: ["/admin/pengaturan"] }
    ]
  }
];

const GURU_NAV: AdminGroup[] = [
  {
    title: "Beranda",
    items: [
      { href: "/guru/dashboard", label: "Dashboard Guru", icon: LayoutDashboard, match: ["/guru/dashboard"] }
    ]
  },
  {
    title: "Konten Akademik",
    items: [
      { href: "/guru/soal", label: "Soal Saya", icon: FileText, match: ["/guru/soal"] },
      { href: "/guru/paket-ujian", label: "Paket Mapel Saya", icon: ClipboardList, match: ["/guru/paket-ujian"] }
    ]
  },
  {
    title: "Penilaian",
    items: [
      { href: "/guru/koreksi-esai", label: "Koreksi Esai", icon: AlertTriangle, match: ["/guru/koreksi-esai"] },
      { href: "/guru/rekap-nilai", label: "Rekap Nilai", icon: Award, match: ["/guru/rekap-nilai"] },
      { href: "/guru/laporan-soal", label: "Laporan Soal", icon: BarChart3, match: ["/guru/laporan-soal"] }
    ]
  }
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    document.body.classList.toggle("drawer-open", open);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("drawer-open");
    };
  }, [open]);

  const isSiswa = user?.role === "siswa";
  const isGuru = user?.role === "guru";
  const homeHref = isSiswa ? "/siswa/dashboard" : isGuru ? "/guru/dashboard" : "/admin/dashboard";
  const staffNav = isGuru ? GURU_NAV : ADMIN_NAV;

  const isActive = (item: NavItem) => {
    const paths = item.match ?? [item.href];
    return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            className="flex shrink-0 items-center gap-2 rounded-btn border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Menu
          </button>
          {/* Logo */}
          <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/quantum-research-logo.png"
              alt="Quantum Research"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-tight text-gray-900">Quantum Research</p>
              <p className="text-xs text-gray-500">Computer Based Test</p>
            </div>
          </Link>
          </div>

          {/* Nav desktop (siswa) */}
          {isSiswa && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
              {SISWA_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active ? "bg-brand-primary/10 text-brand-primary" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right */}
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white p-1 sm:pr-4" title={`${user.username} · ${ROLE_LABEL[user.role] ?? user.role}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold tracking-wide text-white" aria-hidden="true">
                  {initials(user.username)}
                </span>
                <span className="hidden min-w-0 leading-tight sm:block">
                  <span className="block max-w-[160px] truncate text-sm font-semibold text-gray-900">{user.username}</span>
                  <span className="block text-[11px] font-medium text-gray-500">{ROLE_LABEL[user.role] ?? user.role}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-gray-900/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-modal transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-gray-900">Menu</p>
            {user && <p className="text-xs capitalize text-gray-500">{user.username} · {user.role}</p>}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {isSiswa ? (
            <div className="space-y-1">
              {SISWA_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active ? "bg-brand-primary/10 text-brand-primary" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {staffNav.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                            active ? "bg-brand-primary/10 text-brand-primary" : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <item.icon className="h-4 w-4" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-gray-100 px-3 py-4">
          <Link
            href="/change-password"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Ganti Password
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>
    </header>
  );
}
