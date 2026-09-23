"use client";
import { ReactNode, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
import SiswaBottomNav from "./SiswaBottomNav";

export default function SiswaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  if (pathname.startsWith("/siswa/ujian/")) return <div className="student-shell student-exam">{children}</div>;
  // Halaman hasil punya navigasi Sebelumnya/Berikutnya sendiri di bawah;
  // bottom-nav app disembunyikan di sini agar tidak numpuk dua bar.
  const hideBottomNav = pathname.startsWith("/siswa/hasil/");
  return <div className={`student-shell${hideBottomNav ? " student-no-bottom-nav" : ""}`}>
    <header className="student-header"><div className="student-header-inner">
      <Link href="/siswa/dashboard" className="student-brand"><Image src="/quantum-research-logo.png" alt="" width={40} height={40} className="shrink-0 object-contain" priority /><span>QUANTUM<span className="student-brand-sub">RESEARCH · LEARNING SPACE</span></span></Link>
      <nav className="student-desktop-nav" aria-label="Navigasi siswa">{[["tryout", "Tryout"], ["latihan", "Latihan"], ["ujian-aktif", "Ujian Aktif"], ["riwayat", "Riwayat"], ["profil", "Profil"]].map(([route, label]) => <Link key={route} href={`/siswa/${route}`} aria-current={pathname === `/siswa/${route}` || pathname.startsWith(`/siswa/${route}/`) ? "page" : undefined}>{label}</Link>)}</nav>
      <button className="student-logout" disabled={leaving} onClick={async () => { setLeaving(true); await logout(); router.replace("/login"); }}><LogOut size={15} /><span>{leaving ? "Keluar…" : "Keluar"}</span></button>
    </div></header>
    {children}
    {!hideBottomNav && <SiswaBottomNav />}
  </div>;
}
