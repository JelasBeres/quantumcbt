"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, BookOpen, Activity, History, User } from "lucide-react";

const ITEMS = [
  { href: "/siswa/dashboard", label: "Beranda", icon: LayoutDashboard, match: ["/siswa/dashboard"] },
  { href: "/siswa/tryout", label: "Tryout", icon: ClipboardList, match: ["/siswa/tryout", "/siswa/paket"] },
  { href: "/siswa/latihan", label: "Latihan", icon: BookOpen, match: ["/siswa/latihan"] },
  { href: "/siswa/ujian-aktif", label: "Ujian", icon: Activity, match: ["/siswa/ujian-aktif", "/siswa/ujian"] },
  { href: "/siswa/riwayat", label: "Riwayat", icon: History, match: ["/siswa/riwayat", "/siswa/hasil"] },
  { href: "/siswa/profil", label: "Profil", icon: User, match: ["/siswa/profil"] }
];

export default function SiswaBottomNav() {
  const pathname = usePathname();

  // Sembunyikan bottom nav saat berada di ruang ujian
  if (pathname.startsWith("/siswa/ujian/")) return null;

  const isActive = (item: (typeof ITEMS)[number]) =>
    item.match.some((path) => pathname === path || pathname.startsWith(path + "/"));

  return (
    <nav className="bottom-nav-shell" aria-label="Navigasi utama">
      <div className="bottom-nav-bar">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`bottom-nav-item rounded-btn ${active ? "active" : ""}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-btn ${active ? "bg-brand-primary/10" : ""}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
