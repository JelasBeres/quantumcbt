import { RotateCcw } from "lucide-react";

// Tombol reset filter yang seragam di semua halaman. Nonaktif bila belum ada filter terpasang.
export default function ResetFilterButton({ active, onReset, className = "" }: { active: boolean; onReset: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={!active}
      title={active ? "Kosongkan semua filter" : "Belum ada filter aktif"}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-btn border border-card-border bg-card-bg px-3 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-60 disabled:hover:border-card-border disabled:hover:bg-card-bg ${className}`}
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset filter
    </button>
  );
}
