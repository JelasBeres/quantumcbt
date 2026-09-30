"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Parent route used when there is no in-app history (page opened directly / new tab).
function parentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 2) return `/${segments[0] ?? ""}/dashboard`;
  return `/${segments.slice(0, -1).join("/")}`;
}

function packageHref(pathname: string, searchParams: URLSearchParams) {
  const basePath = pathname.startsWith("/guru/") ? "/guru" : "/admin";
  const packageId = searchParams.get("paket_id") || searchParams.get("id");
  if (!packageId || !/^\d+$/.test(packageId)) return null;

  const isAssignment = pathname.endsWith("/paket-ujian/isi-soal");
  const isSetSoal = pathname.endsWith("/paket-ujian/set-soal");
  const isPackageDetail = pathname === `${basePath}/paket-ujian` && searchParams.has("paket_id");
  if (!isAssignment && !isSetSoal && !isPackageDetail) return null;

  const tipe = searchParams.get("tipe") || (isSetSoal ? "latihan" : "");
  const kategori = searchParams.get("kategori_id") || searchParams.get("kategori");
  if (isAssignment || isSetSoal) {
    const query = new URLSearchParams({ paket_id: packageId });
    if (tipe) query.set("tipe", tipe);
    if (kategori) query.set("kategori_id", kategori);
    return `${basePath}/paket-ujian?${query.toString()}`;
  }

  const query = new URLSearchParams();
  if (tipe) query.set("tipe", tipe);
  if (kategori) query.set("kategori_id", kategori);
  return `${basePath}/paket-ujian${query.toString() ? `?${query.toString()}` : ""}`;
}

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[1] === "dashboard") return null;

  const goBack = () => {
    router.push(packageHref(pathname, searchParams) ?? parentPath(pathname));
  };

  return (
    <button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-2 rounded-btn px-2 py-1 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
    </button>
  );
}
