import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export default function Select({ label, error, options, className = "", ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-body-dark">
          {label}
          {props.required && <span className="ml-0.5 text-cta">*</span>}
        </label>
      )}
      <select
        className={`w-full rounded-input border bg-card-bg px-3.5 py-2.5 text-sm text-body-dark transition focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-25 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-red-400" : "border-card-border focus:border-brand-primary"
        } ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
