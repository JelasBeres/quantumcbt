"use client";
import Input from "@/components/Input";
import Select from "@/components/Select";
import { Soal } from "@/lib/types";
export type MetaFilter = { creator: string; from: string; to: string };
export const emptyMetaFilter: MetaFilter = { creator: "", from: "", to: "" };
export function matchesMeta(s: Soal, f: MetaFilter) {
  if (f.creator && String(s.created_by) !== f.creator) return false;
  const timestamp = s.created_at ? new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(s.created_at) ? s.created_at : `${s.created_at}Z`).getTime() : NaN;
  if (f.from && (!Number.isFinite(timestamp) || timestamp < new Date(`${f.from}T00:00:00`).getTime())) return false;
  if (f.to && (!Number.isFinite(timestamp) || timestamp > new Date(`${f.to}T23:59:59.999`).getTime())) return false;
  return true;
}
// `bare` merender ketiga field tanpa pembungkus grid agar halaman bisa menyusunnya
// dalam baris filter sendiri.
export default function QuestionMetaFilters({ items, value, onChange, bare = false }: { items: Soal[]; value: MetaFilter; onChange: (v: MetaFilter) => void; bare?: boolean }) {
  const creators = new Map(items.filter((s) => s.created_by != null).map((s) => [String(s.created_by), s.created_by_name || `Guru #${s.created_by}`]));
  const fields = <>
    <Select label="Pembuat soal" value={value.creator} onChange={(e) => onChange({ ...value, creator: e.target.value })} options={[{ value: "", label: "Semua pembuat" }, ...Array.from(creators, ([value, label]) => ({ value, label }))]} />
    <Input label="Dibuat mulai tanggal" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
    <Input label="Sampai tanggal" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
  </>;
  if (bare) return fields;
  return <div className="my-3 grid gap-3 sm:grid-cols-3">{fields}</div>;
}
