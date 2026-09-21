"use client";
import { ReactNode, useState } from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  searchText?: (row: T) => string;
  paginate?: boolean;
  newestFirst?: boolean;
}

export default function Table<T extends { id?: number | string }>({
  data,
  columns,
  onRowClick,
  emptyMessage = "Tidak ada data",
  searchText,
  paginate = false,
  newestFirst = false
}: TableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = searchText ? data.filter((row) => searchText(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : data;
  const ordered = newestFirst ? [...filtered].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)) : filtered;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = paginate ? (currentPage - 1) * pageSize : 0;
  const visible = paginate ? ordered.slice(start, start + pageSize) : ordered;
  return (
    <div className="space-y-3">
      {searchText && <label className="block text-sm font-semibold text-body-dark">Cari data
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Ketik kata pencarian..." className="mt-2 block w-full rounded-input border border-card-border bg-card-bg px-3 py-2 text-body-dark" />
      </label>}
    <div className="max-w-full overflow-x-auto rounded-card border border-card-border bg-card-bg">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="border-b border-card-border bg-neutral">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted sm:px-5 ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-text-muted">
                {query.trim() ? "Tidak ada data yang cocok dengan pencarian." : emptyMessage}
              </td>
            </tr>
          ) : (
            visible.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-card-border transition last:border-b-0 ${
                  onRowClick ? "cursor-pointer hover:bg-neutral" : ""
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-4 py-3.5 text-sm text-body-dark sm:px-5 ${col.className || ""}`}>
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    {paginate && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-body-dark">
      <p role="status">{ordered.length ? start + 1 : 0}–{Math.min(start + pageSize, ordered.length)} dari {ordered.length} data</p>
      <label>Baris per halaman <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-input border border-card-border bg-card-bg p-2">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <nav aria-label="Halaman tabel" className="flex items-center gap-3">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-input border border-card-border px-3 py-2 disabled:opacity-40">Sebelumnya</button>
        <span>{currentPage} / {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-input border border-card-border px-3 py-2 disabled:opacity-40">Berikutnya</button>
      </nav>
    </div>}
    </div>
  );
}
