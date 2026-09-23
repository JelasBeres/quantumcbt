"use client";
import { useParams } from "next/navigation";
import SiswaPaketSplit from "@/components/SiswaPaketSplit";

export default function TryoutPerKategoriPage() {
  const { kategori } = useParams<{ kategori: string }>();
  return <SiswaPaketSplit tipe="ujian" kategori={decodeURIComponent(kategori)} />;
}
