import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

export default function Skeleton({ className = "", children }: SkeletonProps) {
  return <div className={`skeleton ${className}`}>{children}</div>;
}
