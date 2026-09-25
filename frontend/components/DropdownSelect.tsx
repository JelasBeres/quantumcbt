"use client";

import { KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

// Pengganti <select> bawaan untuk opsi yang banyak: daftar selalu terbuka ke bawah
// (select bawaan browser bisa membuka ke atas) dan punya pencarian bila opsi > 8.
// Daftar dirender lewat portal agar tidak terpotong modal/kontainer ber-scroll.
interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  id?: string;
  name?: string;
}

type Posisi = { top: number; left: number; width: number; maxHeight: number };

export default function DropdownSelect({
  value,
  onChange,
  options,
  label,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  className = "",
  buttonClassName = "",
  disabled = false,
  required = false,
  error,
  id,
  name
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [posisi, setPosisi] = useState<Posisi | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const buttonId = id ?? `${autoId}-button`;
  const listId = `${autoId}-list`;
  const searchable = options.length > 8;

  const selected = options.find((o) => String(o.value) === value);
  const filtered = useMemo(() => {
    const kata = query.trim().toLocaleLowerCase();
    return kata ? options.filter((o) => o.label.toLocaleLowerCase().includes(kata)) : options;
  }, [options, query]);

  const hitungPosisi = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ruangBawah = window.innerHeight - rect.bottom - 12;
    setPosisi({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 224),
      maxHeight: Math.max(160, Math.min(320, ruangBawah))
    });
  }, []);

  useLayoutEffect(() => {
    if (open) hitungPosisi();
  }, [open, hitungPosisi]);

  useEffect(() => {
    if (!open) return;
    const tutup = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    // Ikuti tombol saat halaman/modal di-scroll; scroll di dalam daftar sendiri diabaikan.
    const ikut = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      hitungPosisi();
    };
    // Esc ditangkap lebih dulu (fase capture) supaya tidak ikut menutup Dialog induk.
    const esc = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", tutup);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", ikut, true);
    window.addEventListener("resize", hitungPosisi);
    return () => {
      document.removeEventListener("mousedown", tutup);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", ikut, true);
      window.removeEventListener("resize", hitungPosisi);
    };
  }, [open, hitungPosisi]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => String(o.value) === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, posisi]);

  const pilih = (next: string) => {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = filtered[active];
      if (option) pilih(String(option.value));
    } else if (event.key === "Tab" && open) {
      setOpen(false);
    }
  };

  const panel = open && posisi && (
    <div
      ref={panelRef}
      onKeyDown={onKeyDown}
      style={{ position: "fixed", top: posisi.top, left: posisi.left, width: posisi.width }}
      className="z-[120] flex flex-col overflow-hidden rounded-input border border-card-border bg-card-bg shadow-lg"
    >
      {searchable && (
        <label className="flex items-center gap-2 border-b border-card-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full bg-transparent text-sm text-body-dark outline-none"
          />
        </label>
      )}
      <ul ref={listRef} id={listId} role="listbox" aria-labelledby={buttonId} style={{ maxHeight: posisi.maxHeight - (searchable ? 44 : 0) }} className="overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3.5 py-2 text-sm text-text-muted">Tidak ada yang cocok.</li>
        ) : filtered.map((option, index) => {
          const isSelected = String(option.value) === value;
          return (
            <li
              key={option.value}
              data-index={index}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pilih(String(option.value))}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-sm ${
                index === active ? "bg-neutral" : ""
              } ${isSelected ? "font-semibold text-brand-primary" : "text-body-dark"}`}
            >
              <span>{option.label}</span>
              {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative w-full ${className}`} onKeyDown={onKeyDown}>
      {label && (
        <label htmlFor={buttonId} className="mb-1.5 block text-sm font-semibold text-body-dark">
          {label}
          {required && <span className="ml-0.5 text-cta">*</span>}
        </label>
      )}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-input border bg-card-bg px-3.5 py-2.5 text-left text-sm text-body-dark transition focus:outline-none focus:ring-2 focus:ring-brand-primary/25 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-red-400" : "border-card-border focus:border-brand-primary"
        } ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? "" : "text-text-muted"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {/* Menjaga validasi `required` form bawaan dan pengiriman `name`. */}
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={value}
          onChange={() => undefined}
          onFocus={() => buttonRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
