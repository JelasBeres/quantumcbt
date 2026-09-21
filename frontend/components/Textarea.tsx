import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-body-dark">
          {label}
          {props.required && <span className="ml-0.5 text-cta">*</span>}
        </label>
      )}
      <textarea
        className={`w-full rounded-input border bg-card-bg px-3.5 py-2.5 text-sm text-body-dark placeholder:text-text-muted transition focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-25 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-red-400" : "border-card-border focus:border-brand-primary"
        } ${className}`}
        rows={4}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
