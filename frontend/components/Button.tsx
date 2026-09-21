import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export default function Button({ variant = "primary", size = "md", children, className = "", ...props }: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-btn font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-cta text-heading-light hover:bg-cta-alt focus-visible:ring-cta",
    secondary: "bg-neutral text-body-dark hover:bg-card-border focus-visible:ring-brand-primary",
    danger: "bg-red-600 text-heading-light hover:bg-red-700 focus-visible:ring-red-600",
    outline: "border border-card-border bg-card-bg text-brand-primary hover:bg-neutral focus-visible:ring-brand-primary",
    ghost: "text-brand-primary hover:bg-neutral focus-visible:ring-brand-primary"
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
