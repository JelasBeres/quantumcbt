"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// Parent route used when there is no in-app history (page opened directly / new tab).
function parentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 2) return `/${segments[0] ?? ""}/dashboard`;
  return `/${segments.slice(0, -1).join("/")}`;
}

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const firstPath = useRef(pathname);
  const hasInAppHistory = useRef(false);

  useEffect(() => {
    if (pathname !== firstPath.current) hasInAppHistory.current = true;
  }, [pathname]);

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[1] === "dashboard") return null;

  const goBack = () => {
    if (hasInAppHistory.current) router.back();
    else router.push(parentPath(pathname));
  };

  return (
    <button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-2 rounded-btn px-2 py-1 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
    </button>
  );
}
