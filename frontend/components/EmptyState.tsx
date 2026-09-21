import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title = "Belum ada data", description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral text-brand-primary">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </span>
      <p className="mt-3 text-sm font-semibold text-heading-dark">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
