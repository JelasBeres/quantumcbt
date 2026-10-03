"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, useEditorState, EditorContent, Extension } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Superscript } from "@tiptap/extension-superscript";
import { Subscript } from "@tiptap/extension-subscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";

import EquationEditorDialog from "@/components/EquationEditorDialog";
import MathContent from "@/components/MathContent";
import { api } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Carlito, sans-serif" },
  { label: "Times New Roman", value: '\"Times New Roman\", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Cambria", value: "Cambria, Caladea, serif" }
];
const SIZE_OPTIONS = ["10", "11", "12", "13", "14", "16", "18", "20", "24"];

const primaryFont = (family: string) => family.split(",")[0].replace(/['"]+/g, "").trim().toLowerCase();
const matchFontOption = (family?: string) => {
  if (!family) return "";
  return FONT_OPTIONS.find((font) => primaryFont(font.value) === primaryFont(family))?.value || "";
};

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    }
  },
});

const TOOLBAR_KOSONG = {
  fontFamily: "", fontSize: "", bold: false, italic: false, underline: false, subscript: false, superscript: false,
  paragraph: false, heading: false, blockquote: false, orderedList: false, bulletList: false,
  alignLeft: false, alignCenter: false, alignRight: false, alignJustify: false, table: false,
};

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: string;
  required?: boolean;
}

export default function RichEditor({ value, onChange, placeholder, minHeight = "160px", label, required }: RichEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [equationEditorOpen, setEquationEditorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tableFormOpen, setTableFormOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ rows: 3, cols: 3, header: true });

  const editor = useEditor({
    // Komponen ini hanya dirender di browser (dynamic ssr:false di RichEditor.tsx),
    // jadi editor aman dibuat langsung pada render pertama.
    immediatelyRender: true,
    extensions: [
      StarterKit,
      Superscript,
      Subscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      BackgroundColor,
      FontFamily,
      FontSize,
      Placeholder.configure({ placeholder: placeholder || 'Ketik di sini...' }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rich-content w-full bg-card-bg px-4 py-3 text-sm text-body-dark outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary prose max-w-none",
        style: `min-height: ${minHeight}`
      }
    },
    // Editor kosong dikirim sebagai "" (bukan "<p></p>") agar field opsional
    // seperti pembahasan tersimpan null dan tidak tampil sebagai kotak kosong.
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? "" : editor.getHTML())) {
      if (!editor.isFocused) {
        // Only update content if we aren't actively typing
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  const insertEquation = useCallback((latex: string, displayMode: boolean) => {
    if (!editor) return;
    const text = displayMode ? ` $$${latex}$$ ` : ` $${latex}$ `;
    editor.chain().focus().insertContent(text).run();
    setEquationEditorOpen(false);
  }, [editor]);

  const handleImageFile = useCallback(async (file: File) => {
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
      editor.chain().focus().setImage({ src }).run();
    } catch (error) {
      console.error("Gagal upload gambar:", error);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: tableForm.rows, cols: tableForm.cols, withHeaderRow: tableForm.header }).run();
    setTableFormOpen(false);
  }, [editor, tableForm]);

  // Tiptap v3 tidak re-render di setiap transaksi, jadi status toolbar harus
  // di-subscribe lewat useEditorState agar indikator ikut berubah saat kursor/mark berubah.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const textStyle = editor.getAttributes('textStyle');
      return {
        fontFamily: matchFontOption(textStyle.fontFamily as string | undefined),
        fontSize: String(textStyle.fontSize || "").replace(/pt$/, ""),
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        subscript: editor.isActive('subscript'),
        superscript: editor.isActive('superscript'),
        paragraph: editor.isActive('paragraph'),
        heading: editor.isActive('heading', { level: 3 }),
        blockquote: editor.isActive('blockquote'),
        orderedList: editor.isActive('orderedList'),
        bulletList: editor.isActive('bulletList'),
        alignLeft: editor.isActive({ textAlign: 'left' }),
        alignCenter: editor.isActive({ textAlign: 'center' }),
        alignRight: editor.isActive({ textAlign: 'right' }),
        alignJustify: editor.isActive({ textAlign: 'justify' }),
        table: editor.isActive('table'),
      };
    },
  });

  if (!editor) return null;
  // Status toolbar bisa belum terisi pada render pertama; editor tetap tampil.
  const toolbar = state ?? TOOLBAR_KOSONG;

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
            value={toolbar.fontFamily}
            onChange={(e) => {
              const val = e.target.value;
              if (val) editor.chain().focus().setFontFamily(val).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            className="h-8 rounded border border-card-border bg-card-bg px-1.5 text-xs text-body-dark"
          >
            <option value="">Font</option>
            {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value} style={{ fontFamily: font.value }}>{font.label}</option>)}
          </select>
          <select
            value={toolbar.fontSize}
            onChange={(e) => {
              const val = e.target.value;
              if (val) editor.chain().focus().setFontSize(val + 'pt').run();
              else editor.chain().focus().unsetFontSize().run();
            }}
            className="h-8 rounded border border-card-border bg-card-bg px-1.5 text-xs text-body-dark"
          >
            <option value="">Ukuran</option>
            {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} pt</option>)}
          </select>
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton isActive={toolbar.bold} onClick={() => editor.chain().focus().toggleBold().run()} title="Tebal"><strong>B</strong></ToolbarButton>
          <ToolbarButton isActive={toolbar.italic} onClick={() => editor.chain().focus().toggleItalic().run()} title="Miring"><em>I</em></ToolbarButton>
          <ToolbarButton isActive={toolbar.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Garis bawah"><u>U</u></ToolbarButton>
          <ToolbarButton isActive={toolbar.subscript} onClick={() => {
              if (editor.isActive('subscript')) {
                editor.chain().focus().unsetSubscript().run();
              } else {
                if (editor.isActive('superscript')) {
                  editor.chain().focus().unsetSuperscript().setSubscript().run();
                } else {
                  editor.chain().focus().setSubscript().run();
                }
              }
            }} title="Subscript">x<sub>2</sub></ToolbarButton>
          <ToolbarButton isActive={toolbar.superscript} onClick={() => {
              if (editor.isActive('superscript')) {
                editor.chain().focus().unsetSuperscript().run();
              } else {
                if (editor.isActive('subscript')) {
                  editor.chain().focus().unsetSubscript().setSuperscript().run();
                } else {
                  editor.chain().focus().setSuperscript().run();
                }
              }
            }} title="Superscript">x<sup>2</sup></ToolbarButton>
          
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={toolbar.paragraph} title="Paragraf">P</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={toolbar.heading} title="Judul">H</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={toolbar.blockquote} title="Kutipan">❝</ToolbarButton>
          
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={toolbar.orderedList} title="Daftar bernomor">1.</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={toolbar.bulletList} title="Daftar berpoin">•</ToolbarButton>
          
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={toolbar.alignLeft} title="Rata kiri">≡|</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={toolbar.alignCenter} title="Rata tengah">|≡|</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={toolbar.alignRight} title="Rata kanan">|≡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={toolbar.alignJustify} title="Rata penuh">|≡≡|</ToolbarButton>

          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Hapus format">Tx</ToolbarButton>
          
          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">⟲</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">⟳</ToolbarButton>

          <span className="mx-1 h-5 w-px bg-card-border" />
          <ToolbarButton onClick={() => setEquationEditorOpen(true)} title="Sisipkan rumus matematika">
            <span className="text-sm font-bold">Σ</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => imageInputRef.current?.click()} title={uploading ? "Mengunggah gambar..." : "Sisipkan gambar"}>
            🖼
          </ToolbarButton>
          <ToolbarButton onClick={() => setTableFormOpen(!tableFormOpen)} title="Sisipkan tabel">
            <span className="text-base leading-none">⊞</span>
          </ToolbarButton>
        </div>

        {tableFormOpen && (
          <div className="flex flex-wrap items-end gap-3 border-b border-card-border bg-card-bg px-3 py-2.5 text-xs text-body-dark">
            <label className="flex flex-col gap-1 font-medium">
              Baris
              <input type="number" min={1} max={30} value={tableForm.rows} onChange={(e) => setTableForm({ ...tableForm, rows: Number(e.target.value) })} className="w-16 rounded border border-card-border bg-card-bg px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Kolom
              <input type="number" min={1} max={10} value={tableForm.cols} onChange={(e) => setTableForm({ ...tableForm, cols: Number(e.target.value) })} className="w-16 rounded border border-card-border bg-card-bg px-2 py-1" />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 font-medium">
              <input type="checkbox" checked={tableForm.header} onChange={(e) => setTableForm({ ...tableForm, header: e.target.checked })} />
              Baris pertama sebagai judul
            </label>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setTableFormOpen(false)} className="rounded border border-card-border px-3 py-1.5 font-semibold hover:bg-neutral">Batal</button>
              <button type="button" onClick={insertTable} className="rounded bg-brand-primary px-3 py-1.5 font-semibold text-heading-light hover:bg-brand-primary-light">Sisipkan Tabel</button>
            </div>
          </div>
        )}

        {toolbar.table && (
          <div className="flex flex-wrap items-center gap-1 border-b border-card-border bg-brand-primary/5 px-2 py-1.5 text-xs">
            <span className="mr-1 font-semibold text-text-muted">Tabel:</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light text-body-dark">+ Baris</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light text-body-dark">+ Kolom</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className="rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light text-body-dark">− Baris</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light text-body-dark">− Kolom</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()} className="rounded px-2 py-1 font-semibold transition hover:bg-brand-primary hover:text-heading-light text-cta">Hapus Tabel</button>
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
      
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageFile(file); }} />
      
      {value && (
        <div className="mt-2 rounded-lg border border-card-border bg-neutral p-4">
          <p className="mb-1 text-xs font-medium text-text-muted">Preview:</p>
          <MathContent className="prose prose-sm max-w-none" html={value} />
        </div>
      )}
      
      <EquationEditorDialog open={equationEditorOpen} onClose={() => { setEquationEditorOpen(false); editor.commands.focus(); }} onInsert={insertEquation} />
      
      <style jsx global>{`
        .ProseMirror { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .ProseMirror table td, .ProseMirror table th {
          min-width: 1em;
          border: 1px solid #ddd;
          padding: 3px 5px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror table th { font-weight: bold; text-align: left; background-color: #f8f9fa; }
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          z-index: 20;
          background-color: #adf;
          pointer-events: none;
        }
        .ProseMirror table p { margin: 0; }
        .ProseMirror img { max-width: 100%; height: auto; }
      `}</style>
    </div>
  );
}

function ToolbarButton({ onClick, title, children, isActive }: { onClick: () => void; title: string; children: React.ReactNode; isActive?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      style={isActive ? { backgroundColor: '#2D3C8F', color: '#ffffff' } : {}}
      className={`flex min-w-[32px] h-8 px-1 items-center justify-center rounded text-xs font-medium transition ${!isActive ? "text-body-dark hover:bg-brand-primary hover:text-heading-light" : ""}`}
    >
      {children}
    </button>
  );
}

export { sanitizeHtml };
