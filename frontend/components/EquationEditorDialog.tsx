"use client";

import type { MathfieldElement } from "mathlive";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";

interface EquationEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string, displayMode: boolean) => void;
}

const templates = [
  { label: "a/b", latex: "\\frac{}{}", title: "Pecahan" },
  { label: "√", latex: "\\sqrt{}", title: "Akar" },
  { label: "x²", latex: "^{}", title: "Pangkat" },
  { label: "xₙ", latex: "_{}", title: "Indeks" },
  { label: "∫", latex: "\\int_{}^{}", title: "Integral" },
  { label: "Σ", latex: "\\sum_{}^{}", title: "Sigma" },
  { label: "π", latex: "\\pi", title: "Pi" },
  { label: "≤", latex: "\\le", title: "Kurang dari atau sama dengan" }
];

export default function EquationEditorDialog({ open, onClose, onInsert }: EquationEditorDialogProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled || !hostRef.current) return;
      const field = new MathfieldElement();
      field.mathVirtualKeyboardPolicy = "manual";
      field.smartFence = true;
      field.placeholder = "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}";
      field.style.width = "100%";
      field.style.minHeight = "64px";
      field.style.padding = "12px";
      field.style.fontSize = "1.5rem";
      field.style.border = "1px solid var(--color-card-border)";
      field.style.borderRadius = "var(--radius-input)";
      field.style.background = "var(--color-card-bg)";
      field.style.color = "var(--color-body-dark)";
      field.style.outline = "none";
      field.addEventListener("focus", () => {
        field.style.borderColor = "var(--color-brand-primary)";
        field.style.boxShadow = "0 0 0 2px rgba(45, 60, 143, 0.25)";
      });
      field.addEventListener("blur", () => {
        field.style.borderColor = "var(--color-card-border)";
        field.style.boxShadow = "none";
      });
      field.addEventListener("input", () => setLatex(field.value));
      hostRef.current.replaceChildren(field);
      mathfieldRef.current = field;
      requestAnimationFrame(() => field.focus());
    });

    return () => {
      cancelled = true;
      window.mathVirtualKeyboard?.hide({ animate: false });
      mathfieldRef.current = null;
      hostRef.current?.replaceChildren();
      setLatex("");
    };
  }, [open]);

  if (!open) return null;

  const insertTemplate = (value: string) => {
    mathfieldRef.current?.insert(value, { insertionMode: "replaceSelection" });
    mathfieldRef.current?.focus();
  };

  const submit = (displayMode: boolean) => {
    const value = mathfieldRef.current?.value.trim() || latex.trim();
    if (!value) return;
    onInsert(value, displayMode);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-heading-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="equation-editor-title">
      <div className="w-full max-w-2xl rounded-modal border border-card-border bg-card-bg shadow-modal">
        <div className="flex items-start justify-between gap-4 border-b border-card-border px-4 py-4 sm:px-6">
          <div>
            <h2 id="equation-editor-title" className="text-lg font-bold text-heading-dark">Editor Rumus Matematika</h2>
            <p className="mt-1 text-sm text-text-muted">Ketik rumus langsung atau gunakan tombol simbol di bawah.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-text-muted transition hover:bg-neutral hover:text-heading-dark" aria-label="Tutup editor rumus">×</button>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div ref={hostRef} />

          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.title}
                type="button"
                title={template.title}
                onClick={() => insertTemplate(template.latex)}
                className="min-w-10 rounded-lg border border-card-border bg-neutral px-3 py-2 text-sm font-semibold text-body-dark transition hover:border-brand-primary hover:bg-card-bg"
              >
                {template.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                mathfieldRef.current?.focus();
                window.mathVirtualKeyboard?.show({ animate: true });
              }}
              className="rounded-lg border border-brand-primary px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-heading-light"
            >
              Keyboard Matematika
            </button>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-card-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="button" variant="outline" disabled={!latex.trim()} onClick={() => submit(false)}>Sisipkan Inline</Button>
            <Button type="button" disabled={!latex.trim()} onClick={() => submit(true)}>Sisipkan Baris Baru</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
