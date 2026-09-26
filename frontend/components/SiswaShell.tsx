"use client";
import { ReactNode, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
import SiswaBottomNav from "./SiswaBottomNav";
import PemberitahuanProvider, { usePemberitahuan } from "./PemberitahuanProvider";

const NAV = [["tryout", "Try Out"], ["latihan", "Latihan"], ["ujian-aktif", "Ujian Aktif"], ["riwayat", "Riwayat"], ["pemberitahuan", "Pemberitahuan"], ["profil", "Profil"]];

function JumlahBelumDibaca({ className }: { className: string }) {
  const { belumDibaca } = usePemberitahuan();
  if (belumDibaca <= 0) return null;
  return <span className={className} aria-label={`${belumDibaca} belum dibaca`}>{belumDibaca > 99 ? "99+" : belumDibaca}</span>;
}

export default function SiswaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  if (pathname.startsWith("/siswa/ujian/")) return <div className="student-shell student-exam">{children}</div>;
  // Halaman hasil punya navigasi Sebelumnya/Berikutnya sendiri di bawah;
  // bottom-nav app disembunyikan di sini agar tidak numpuk dua bar.
  const hideBottomNav = pathname.startsWith("/siswa/hasil/");
  const aktif = (route: string) => pathname === `/siswa/${route}` || pathname.startsWith(`/siswa/${route}/`);
  return <div className={`student-shell${hideBottomNav ? " student-no-bottom-nav" : ""}`}><PemberitahuanProvider>
    <header className="student-header"><div className="student-header-inner">
      <Link href="/siswa/dashboard" className="student-brand"><Image src="/quantum-research-logo.png" alt="" width={40} height={40} className="shrink-0 object-contain" priority /><span>QUANTUM RESEARCH<span className="student-brand-sub">&ldquo;Tekun, logis, kreatif&rdquo;</span></span></Link>
      <nav className="student-desktop-nav" aria-label="Navigasi siswa">{NAV.map(([route, label]) => <Link key={route} href={`/siswa/${route}`} aria-current={aktif(route) ? "page" : undefined}>{label}{route === "pemberitahuan" && <JumlahBelumDibaca className="student-nav-count" />}</Link>)}</nav>
      <Link href="/siswa/pemberitahuan" className="student-bell" aria-label="Pemberitahuan" aria-current={aktif("pemberitahuan") ? "page" : undefined}><Bell size={19} /><JumlahBelumDibaca className="student-bell-count" /></Link>
      <button className="student-logout" aria-label="Keluar" disabled={leaving} onClick={async () => { setLeaving(true); await logout(); router.replace("/login"); }}><LogOut size={15} /><span>{leaving ? "Keluar…" : "Keluar"}</span></button>
    </div></header>
    {children}
    {!hideBottomNav && <SiswaBottomNav />}
  </PemberitahuanProvider></div>;
}
