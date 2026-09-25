import { ChangeEvent, SelectHTMLAttributes } from "react";
import DropdownSelect from "./DropdownSelect";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

// Opsi lebih dari ini (umumnya data master: paket, mapel, kelas, bab) memakai
// DropdownSelect: selalu membuka ke bawah dan bisa dicari. Opsi sedikit tetap
// memakai <select> bawaan (picker sistem di HP lebih nyaman).
const BATAS_OPSI_NATIVE = 8;

export default function Select({ label, error, options, className = "", ...props }: SelectProps) {
  if (options.length > BATAS_OPSI_NATIVE && !props.multiple) {
    return (
      <DropdownSelect
        label={label}
        error={error}
        options={options}
        value={props.value == null ? "" : String(props.value)}
        onChange={(value) =>
          props.onChange?.({ target: { value, name: props.name }, currentTarget: { value, name: props.name } } as unknown as ChangeEvent<HTMLSelectElement>)
        }
        disabled={props.disabled}
        required={props.required}
        id={props.id}
        name={props.name}
        buttonClassName={className}
      />
    );
  }

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
