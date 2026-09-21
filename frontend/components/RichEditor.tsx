"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import EquationEditorDialog from "@/components/EquationEditorDialog";
import MathContent from "@/components/MathContent";
import { api } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";

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

  const emit = useCallback(() => {
    if (editorRef.current) {
      onChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  }, [onChange]);

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
    emit();
    editorRef.current?.focus();
  }, [emit]);

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
        <div className="flex flex-wrap gap-0.5 border-b border-card-border bg-neutral px-2 py-1.5">
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
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) onChange(sanitizeHtml(editorRef.current.innerHTML));
          }}
          onPaste={handlePaste}
          style={{ minHeight }}
          className="w-full bg-card-bg px-4 py-3 text-sm text-body-dark outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
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
