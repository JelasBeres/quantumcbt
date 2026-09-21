import { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral text-body-dark",
  success: "bg-green-50 text-green-700 border border-green-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-red-50 text-red-700 border border-red-200",
  info: "bg-blue-50 text-blue-800 border border-blue-200",
  primary: "bg-brand-primary/10 text-brand-primary"
};

export default function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
