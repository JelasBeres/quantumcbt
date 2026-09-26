import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
  /** Kalau diisi, kartu jadi tombol navigasi ke halaman ini. */
  href?: string;
}

export default function StatCard({ label, value, icon, className = "", href }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">{label}</p>
        {icon && <span className="text-brand-primary">{icon}</span>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xl font-bold text-heading-dark">{value}</p>
        {href && <ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-primary" aria-hidden="true" />}
      </div>
    </>
  );
  const base = `rounded-card border border-card-border bg-card-bg px-4 py-3.5 shadow-card ${className}`;
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link href={href} className={`group block ${base} transition hover:border-brand-primary/40 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30`}>
      {body}
    </Link>
  );
}
