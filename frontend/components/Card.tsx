import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export default function Card({ children, className = "", title, action }: CardProps) {
  return (
    <div className={`rounded-card border border-card-border bg-card-bg shadow-card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border px-5 py-4">
          {title && <h3 className="text-base font-bold text-heading-dark">{title}</h3>}
          {action && <div className="max-w-full">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
