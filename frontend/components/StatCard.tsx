import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}

export default function StatCard({ label, value, icon, className = "" }: StatCardProps) {
  return (
    <div className={`rounded-card border border-card-border bg-card-bg px-4 py-3.5 shadow-card ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">{label}</p>
        {icon && <span className="text-brand-primary">{icon}</span>}
      </div>
      <p className="mt-1 text-xl font-bold text-heading-dark">{value}</p>
    </div>
  );
}
