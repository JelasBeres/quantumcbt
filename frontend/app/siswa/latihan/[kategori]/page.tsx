"use client";
import { useParams } from "next/navigation";
import SiswaPaketSplit from "@/components/SiswaPaketSplit";

export default function LatihanPerKategoriPage() {
  const { kategori } = useParams<{ kategori: string }>();
  return <SiswaPaketSplit tipe="latihan" kategori={decodeURIComponent(kategori)} />;
}
