"use client";

import { InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export default function Input({ label, error, helper, className = "", type, ...props }: InputProps) {
  // Kolom password punya tombol mata untuk menampilkan/menyembunyikan isian.
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-body-dark">
          {label}
          {props.required && <span className="ml-0.5 text-cta">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          className={`w-full rounded-input border bg-card-bg px-3.5 py-2.5 text-sm text-body-dark placeholder:text-text-muted transition focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-25 disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? "border-red-400" : "border-card-border focus:border-brand-primary"
          } ${isPassword ? "pr-10" : ""} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            disabled={props.disabled}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-input text-text-muted transition hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && helper && <p className="mt-1 text-xs text-text-muted">{helper}</p>}
    </div>
  );
}
