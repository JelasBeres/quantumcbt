"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import EquationEditorDialog from "@/components/EquationEditorDialog";
import MathContent from "@/components/MathContent";
import { api } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";

// Pilihan font & ukuran di toolbar. Nilai disimpan sebagai inline style pada <span>
// (tag <font> tidak lolos sanitasi).
const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Carlito, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Cambria", value: "Cambria, Caladea, serif" }
];
const SIZE_OPTIONS = ["10", "11", "12", "13", "14", "16", "18", "20", "24"];

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: string;
  required?: boolean;
}

export default function RichEditor({ value, onChange, placeholder, minHeight = "160px", label, required }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [equationEditorOpen, setEquationEditorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tableFormOpen, setTableFormOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ rows: 3, cols: 3, header: true });
  const [activeCell, setActiveCell] = useState<HTMLTableCellElement | null>(null);
  const tableRangeRef = useRef<Range | null>(null);
  // Seleksi terakhir di dalam editor; dropdown font mencuri fokus sehingga seleksi perlu dipulihkan.
  const lastRangeRef = useRef<Range | null>(null);

  const emit = useCallback(() => {
    if (editorRef.current) {
      onChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  }, [onChange]);

  // Lebar kolom tabel bisa digeser: tarik garis kanan sel. Lebar disimpan
  // sebagai style width (px) di setiap sel kolom tersebut.
  const RESIZE_ZONE = 6;
  const cellAtEdge = (target: EventTarget | null, clientX: number) => {
    const cell = (target as HTMLElement | null)?.closest?.("td, th") as HTMLTableCellElement | null;
    if (!cell || !editorRef.current?.contains(cell)) return null;
    const rect = cell.getBoundingClientRect();
    return rect.right - clientX <= RESIZE_ZONE && rect.right - clientX >= -2 ? cell : null;
  };
  const handleResizeHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.buttons) return;
    const editor = editorRef.current;
    if (editor) editor.style.cursor = cellAtEdge(event.target, event.clientX) ? "col-resize" : "";
  };
  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    const cell = cellAtEdge(event.target, event.clientX);
    const table = cell?.closest("table");
    if (!cell || !table) return;
    event.preventDefault();
    const col = cell.cellIndex;
    const startX = event.clientX;
    const startWidth = cell.getBoundingClientRect().width;
    const cells = Array.from(table.rows).map((row) => row.cells[col]).filter(Boolean) as HTMLTableCellElement[];
    const onMove = (e: MouseEvent) => {
      const width = Math.max(40, Math.round(startWidth + e.clientX - startX));
      cells.forEach((c) => { c.style.width = `${width}px`; c.style.minWidth = `${width}px`; });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (editorRef.current) editorRef.current.style.cursor = "";
      emit();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    const sanitized = sanitizeHtml(value);
    if (editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    // Chrome membuat daftar di dalam <p> (<p><ol>..</ol></p>), yang tidak valid dan
    // memunculkan paragraf kosong saat dirender. Keluarkan daftar dari <p> pembungkusnya.
    if (cmd === "insertOrderedList" || cmd === "insertUnorderedList") {
      editorRef.current?.querySelectorAll("p > ol, p > ul").forEach((list) => {
        const p = list.parentElement!;
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        while (p.firstChild) p.before(p.firstChild);
        p.remove();
        if (range && range.startContainer.isConnected) {
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });
    }
    // Chrome kadang menyalin ukuran font bawaan editor ke <span style="font-size">
    // (mis. saat membatalkan daftar). Span itu tidak dipilih pengguna, jadi dilepas
    // agar ukuran teks tetap mengikuti tampilan tempat soal dirender.
    const editor = editorRef.current;
    if (editor) {
      const ukuranBawaan = getComputedStyle(editor).fontSize;
      editor.querySelectorAll<HTMLSpanElement>("span[style]").forEach((span) => {
        if (span.style.length !== 1 || !span.style.fontSize) return;
        if (getComputedStyle(span).fontSize !== ukuranBawaan) return;
        while (span.firstChild) span.before(span.firstChild);
        span.remove();
      });
    }
    emit();
    editorRef.current?.focus();
  }, [emit]);

  // Terapkan font/ukuran ke teks terpilih: execCommand membuat <font> sementara yang
  // langsung diganti <span style>. Tanpa seleksi teks, tidak ada yang diubah.
  const applyFontStyle = useCallback((prop: "font-family" | "font-size", value: string) => {
    const editor = editorRef.current;
    const range = lastRangeRef.current;
    if (!editor || !value) return;
    if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      window.alert("Blok (seleksi) dulu teks yang ingin diubah font atau ukurannya.");
      return;
    }
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("styleWithCSS", false, "false");
    if (prop === "font-family") document.execCommand("fontName", false, "__qfont__");
    else document.execCommand("fontSize", false, "7");
    const selector = prop === "font-family" ? 'font[face="__qfont__"]' : 'font[size="7"]';
    editor.querySelectorAll(selector).forEach((font) => {
      const span = document.createElement("span");
      span.style.setProperty(prop, prop === "font-size" ? `${value}pt` : value);
      while (font.firstChild) span.appendChild(font.firstChild);
      // Ukuran/font lama di dalam seleksi dibuang agar pilihan baru yang berlaku.
      span.querySelectorAll<HTMLElement>("[style]").forEach((child) => {
        child.style.removeProperty(prop);
        if (!child.getAttribute("style")) child.removeAttribute("style");
      });
      font.replaceWith(span);
    });
    emit();
  }, [emit]);

  // Sel tabel tempat kursor berada (untuk menampilkan alat tambah/hapus baris & kolom).
  useEffect(() => {
    const onSelection = () => {
      const editor = editorRef.current;
      const node = window.getSelection()?.anchorNode;
      if (!editor || !node || !editor.contains(node)) {
        setActiveCell(null);
        return;
      }
      const selection = window.getSelection();
      if (selection?.rangeCount) lastRangeRef.current = selection.getRangeAt(0).cloneRange();
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      const cell = el?.closest("td, th") as HTMLTableCellElement | null;
      setActiveCell(cell && editor.contains(cell) ? cell : null);
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  const placeCaret = useCallback((cell: Element) => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const openTableForm = useCallback(() => {
    const selection = window.getSelection();
    tableRangeRef.current =
      selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0).cloneRange()
        : null;
    setTableFormOpen((open) => !open);
  }, []);

  const insertTable = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const rows = Math.min(Math.max(tableForm.rows, 1), 30);
    const cols = Math.min(Math.max(tableForm.cols, 1), 10);
    const cells = (tag: "td" | "th") => Array.from({ length: cols }, () => `<${tag}><br></${tag}>`).join("");
    const head = tableForm.header ? `<thead><tr>${cells("th")}</tr></thead>` : "";
    const bodyRows = Array.from({ length: tableForm.header ? Math.max(rows - 1, 1) : rows }, () => `<tr>${cells("td")}</tr>`).join("");
    const html = `<table data-baru="1">${head}<tbody>${bodyRows}</tbody></table><p><br></p>`;

    editor.focus();
    const range = tableRangeRef.current;
    const selection = window.getSelection();
    if (range && range.commonAncestorContainer.isConnected && editor.contains(range.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("insertHTML", false, html);
    } else {
      editor.insertAdjacentHTML("beforeend", html);
    }
    const inserted = editor.querySelector("table[data-baru]");
    inserted?.removeAttribute("data-baru");
    const firstCell = inserted?.querySelector("th, td");
    if (firstCell) placeCaret(firstCell);
    tableRangeRef.current = null;
    setTableFormOpen(false);
    emit();
  }, [emit, placeCaret, tableForm]);

  const editTable = useCallback((action: "addRow" | "addCol" | "delRow" | "delCol" | "delTable") => {
    const cell = activeCell;
    const row = cell?.parentElement as HTMLTableRowElement | null;
    const table = cell?.closest("table");
    if (!cell || !row || !table) return;
    const colIndex = cell.cellIndex;
    const allRows = Array.from(table.rows);
    let next: Element | null = cell;

    if (action === "addRow") {
      const newRow = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i += 1) newRow.appendChild(document.createElement("td")).innerHTML = "<br>";
      // Baris judul (thead) tidak diduplikasi; baris baru selalu masuk ke isi tabel.
      if (row.parentElement?.tagName === "THEAD") {
        const body = table.tBodies[0] ?? table.appendChild(document.createElement("tbody"));
        body.insertBefore(newRow, body.firstChild);
      } else {
        row.after(newRow);
      }
      next = newRow.cells[Math.min(colIndex, newRow.cells.length - 1)];
    } else if (action === "addCol") {
      for (const r of allRows) {
        const ref = r.cells[Math.min(colIndex, r.cells.length - 1)];
        const newCell = document.createElement(r.parentElement?.tagName === "THEAD" ? "th" : "td");
        newCell.innerHTML = "<br>";
        if (ref) ref.after(newCell);
        else r.appendChild(newCell);
      }
      next = row.cells[colIndex + 1] ?? cell;
    } else if (action === "delRow") {
      if (allRows.length <= 1) {
        next = table.nextElementSibling;
        table.remove();
      } else {
        const index = allRows.indexOf(row);
        const neighbour = allRows[index + 1] ?? allRows[index - 1];
        row.remove();
        next = neighbour.cells[Math.min(colIndex, neighbour.cells.length - 1)];
      }
    } else if (action === "delCol") {
      if (row.cells.length <= 1) {
        next = table.nextElementSibling;
        table.remove();
      } else {
        for (const r of allRows) r.cells[Math.min(colIndex, r.cells.length - 1)]?.remove();
        next = row.cells[Math.max(colIndex - 1, 0)];
      }
    } else {
      next = table.nextElementSibling;
      table.remove();
    }

    editorRef.current?.focus();
    if (next && editorRef.current?.contains(next)) placeCaret(next);
    else setActiveCell(null);
    emit();
  }, [activeCell, emit, placeCaret]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Tab berpindah antarsel tabel (Shift+Tab mundur), seperti di pengolah kata.
    if (e.key !== "Tab" || !activeCell) return;
    const table = activeCell.closest("table");
    if (!table) return;
    const cells = Array.from(table.querySelectorAll("th, td"));
    const target = cells[cells.indexOf(activeCell) + (e.shiftKey ? -1 : 1)];
    if (!target) return;
    e.preventDefault();
    placeCaret(target);
  }, [activeCell, placeCaret]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const cleaned = sanitizeHtml(html);
    if (cleaned) {
      document.execCommand("insertHTML", false, cleaned);
    } else if (plain) {
      document.execCommand("insertText", false, plain);
    }
    emit();
  }, [emit]);

  const openEquationEditor = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
    setEquationEditorOpen(true);
  }, []);

  const handleImageFile = useCallback(async (file: File) => {
    const editor = editorRef.current;
    if (!editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/upload/gambar", formData);
      const rawUrl: string = res.data.url;
      const src = /^https?:\/\//i.test(rawUrl)
        ? rawUrl.replace(/^http:\/\//i, "https://")
        : `/api${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
      document.execCommand("insertHTML", false, `<img src="${src}" alt="gambar" style="max-width:100%;height:auto;" />`);
      emit();
      editor.focus();
    } catch (error) {
      console.error("Gagal upload gambar:", error);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [emit]);

  const insertEquation = useCallback((latex: string, displayMode: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;

    const text = displayMode ? ` $$${latex}$$ ` : `$${latex}$`;
    const textNode = document.createTextNode(text);
    const range = savedRangeRef.current;

    if (range && range.commonAncestorContainer.isConnected && editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
    } else {
      editor.appendChild(textNode);
    }

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (range) selection?.addRange(range);

    onChange(sanitizeHtml(editor.innerHTML));
    savedRangeRef.current = null;
    setEquationEditorOpen(false);
  }, [onChange]);

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-body-dark">
          {label}
          {required && <span className="ml-1 text-cta">*</span>}
        </label>
      )}
      <div className="overflow-hidden rounded-input border border-card-border">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-card-border bg-neutral px-2 py-1.5">
          <select
            aria-label="Jenis font"
            title="Jenis font (blok teks dulu)"
            value=""
            onChange={(e) => applyFontStyle("font-family", e.target.value)}
            className="h-7 rounded border border-card-border bg-card-bg px-1.5 text-xs text-body-dark"
          >
            <option value="">Font</option>
            {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value} style={{ fontFamily: font.value }}>{font.label}</option>)}
          </select>
          <select
            aria-label="Ukuran font"
            title="Ukuran font (blok teks dulu)"
            value=""
            onChange={(e) => applyFontStyle("font-size", e.target.value)}
            className="h-7 rounded border border-card-border bg-card-bg px-1.5 text-xs text-body-dark"
          >
            <option value="">Ukuran</option>
            {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} pt</option>)}
          </select>
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("bold")} title="Tebal">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("italic")} title="Miring">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("underline")} title="Garis bawah">
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("subscript")} title="Subscript">
            x<sub>2</sub>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("superscript")} title="Superscript">
            x<sup>2</sup>
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("formatBlock", "<p>")} title="Paragraf">
            P
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("formatBlock", "<h3>")} title="Judul">
            H
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("formatBlock", "<blockquote>")} title="Kutipan">
            ❝
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("insertOrderedList")} title="Daftar bernomor">
            1.
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Daftar berpoin">
            •
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("justifyLeft")} title="Rata kiri">
            ≡|
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("justifyCenter")} title="Rata tengah">
            |≡|
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("justifyRight")} title="Rata kanan">
            |≡
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("justifyFull")} title="Rata kanan-kiri (justify)">
            |≡≡|
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("removeFormat")} title="Hapus format">
            Tx
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={() => exec("undo")} title="Undo">
            ⟲
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("redo")} title="Redo">
            ⟳
          </ToolbarButton>
          <span className="mx-1 w-px bg-card-border" />
          <ToolbarButton onClick={openEquationEditor} title="Sisipkan rumus matematika">
            <span className="text-sm font-bold">Σ</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => imageInputRef.current?.click()}
            title={uploading ? "Mengunggah gambar..." : "Sisipkan gambar"}
          >
            🖼
          </ToolbarButton>
          <ToolbarButton onClick={openTableForm} title="Sisipkan tabel">
            <span className="text-base leading-none">⊞</span>
          </ToolbarButton>
        </div>
        {tableFormOpen && (
          <div className="flex flex-wrap items-end gap-3 border-b border-card-border bg-card-bg px-3 py-2.5 text-xs text-body-dark">
            <label className="flex flex-col gap-1 font-medium">
              Baris
              <input
                type="number"
                min={1}
                max={30}
                value={tableForm.rows}
                onChange={(e) => setTableForm({ ...tableForm, rows: Number(e.target.value) })}
                className="w-16 rounded border border-card-border bg-card-bg px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Kolom
              <input
                type="number"
                min={1}
                max={10}
                value={tableForm.cols}
                onChange={(e) => setTableForm({ ...tableForm, cols: Number(e.target.value) })}
                className="w-16 rounded border border-card-border bg-card-bg px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 font-medium">
              <input
                type="checkbox"
                checked={tableForm.header}
                onChange={(e) => setTableForm({ ...tableForm, header: e.target.checked })}
              />
              Baris pertama sebagai judul
            </label>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setTableFormOpen(false)} className="rounded border border-card-border px-3 py-1.5 font-semibold hover:bg-neutral">
                Batal
              </button>
              <button type="button" onClick={insertTable} className="rounded bg-brand-primary px-3 py-1.5 font-semibold text-heading-light hover:bg-brand-primary-light">
                Sisipkan Tabel
              </button>
            </div>
          </div>
        )}
        {activeCell && (
          <div className="flex flex-wrap items-center gap-1 border-b border-card-border bg-brand-primary/5 px-2 py-1.5 text-xs">
            <span className="mr-1 font-semibold text-text-muted">Tabel:</span>
            {([
              ["addRow", "+ Baris"],
              ["addCol", "+ Kolom"],
              ["delRow", "− Baris"],
              ["delCol", "− Kolom"],
              ["delTable", "Hapus Tabel"],
            ] as const).map(([action, text]) => (
              <button
                key={action}
                type="button"
                // mousedown dicegah supaya kursor tetap di sel yang aktif
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editTable(action)}
                className={`rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light ${action === "delTable" ? "text-cta" : "text-body-dark"}`}
              >
                {text}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-text-muted">Tarik garis kanan sel untuk mengubah lebar kolom</span>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) onChange(sanitizeHtml(editorRef.current.innerHTML));
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onMouseMove={handleResizeHover}
          onMouseDown={handleResizeStart}
          style={{ minHeight }}
          className="rich-content w-full bg-card-bg px-4 py-3 text-sm text-body-dark outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
          data-placeholder={placeholder}
        />
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
        }}
      />
      {value && (
        <div className="mt-2 rounded-lg border border-card-border bg-neutral p-4">
          <p className="mb-1 text-xs font-medium text-text-muted">Preview:</p>
          <MathContent className="prose prose-sm max-w-none" html={value} />
        </div>
      )}
      <EquationEditorDialog
        open={equationEditorOpen}
        onClose={() => {
          savedRangeRef.current = null;
          setEquationEditorOpen(false);
          editorRef.current?.focus();
        }}
        onInsert={insertEquation}
      />
      <style jsx>{`
        div[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--color-text-muted);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded text-xs font-medium text-body-dark transition hover:bg-brand-primary hover:text-heading-light"
    >
      {children}
    </button>
  );
}

export { sanitizeHtml };
