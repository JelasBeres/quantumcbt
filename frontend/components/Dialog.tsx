"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";

type DialogVariant = "primary" | "danger";

type DialogOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: DialogVariant;
};

type PromptOptions = DialogOptions & {
  inputLabel: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
};

type DialogRequest = DialogOptions & {
  mode: "alert" | "confirm" | "prompt";
  inputLabel?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  value: string;
  error: string;
  resolve: (value: boolean | string | null) => void;
};

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: DialogVariant;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Dialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Simpan",
  cancelLabel = "Batal",
  confirmVariant = "primary",
  showCancel = true,
  onConfirm,
  onCancel
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-heading-dark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
      <div className="w-full max-w-md rounded-modal border border-card-border bg-card-bg shadow-modal">
        <div className="border-b border-card-border px-5 py-4">
          <h2 id="app-dialog-title" className="text-lg font-bold text-heading-dark">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>}
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        <div className="flex justify-end gap-2 border-t border-card-border px-5 py-4">
          {showCancel && <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>}
          <Button type="button" variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function useAppDialog() {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const showAlert = useCallback((options: DialogOptions) => new Promise<void>((resolve) => {
    setRequest({ ...options, mode: "alert", value: "", error: "", resolve: () => resolve() });
  }), []);

  const showConfirm = useCallback((options: DialogOptions) => new Promise<boolean>((resolve) => {
    setRequest({ ...options, mode: "confirm", value: "", error: "", resolve: (value) => resolve(value === true) });
  }), []);

  const showPrompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    setRequest({ ...options, mode: "prompt", value: "", error: "", resolve: (value) => resolve(typeof value === "string" ? value : null) });
  }), []);

  const cancel = useCallback(() => {
    if (!request) return;
    request.resolve(request.mode === "confirm" ? false : null);
    setRequest(null);
  }, [request]);

  const confirm = useCallback(() => {
    if (!request) return;
    if (request.mode === "prompt") {
      const value = request.value.trim();
      const minLength = request.minLength ?? 1;
      if (request.required !== false && value.length < minLength) {
        setRequest((current) => current ? { ...current, error: `Wajib diisi minimal ${minLength} karakter.` } : current);
        return;
      }
      request.resolve(value);
    } else if (request.mode === "confirm") {
      request.resolve(true);
    } else {
      request.resolve(true);
    }
    setRequest(null);
  }, [request]);

  const dialog = request ? (
    <Dialog
      open
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel ?? (request.mode === "alert" ? "Tutup" : "Konfirmasi")}
      cancelLabel={request.cancelLabel}
      confirmVariant={request.confirmVariant}
      showCancel={request.mode !== "alert"}
      onConfirm={confirm}
      onCancel={cancel}
    >
      {request.mode === "prompt" && (
        <Textarea
          autoFocus
          required={request.required !== false}
          label={request.inputLabel}
          placeholder={request.placeholder}
          value={request.value}
          error={request.error}
          onChange={(event) => setRequest((current) => current ? { ...current, value: event.target.value, error: "" } : current)}
        />
      )}
    </Dialog>
  ) : null;

  return { showAlert, showConfirm, showPrompt, dialog };
}
