"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import SoalFormModal from "@/components/SoalFormModal";
import { api, getErrorMessage } from "@/lib/api";
import { Kelas, Pelajaran, Topik } from "@/lib/types";

type GuruScope = { pelajaran_id: number; kelas_id?: number | null };

export default function GuruTambahSoalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSoalId = searchParams.get("id");
  const defaultPelajaranId = searchParams.get("pelajaran_id");
  const defaultKelasId = searchParams.get("kelas_id");
  const defaultTopikId = searchParams.get("topik_id");
  const defaultSubbab = searchParams.get("subbab");
  const defaultTipe = searchParams.get("tipe");
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [topikList, setTopikList] = useState<Topik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/guru-scope/me"),
      api.get("/pelajaran/"),
      api.get("/kelas/"),
      api.get("/topik/")
    ])
      .then(([scopeRes, pelajaranRes, kelasRes, topikRes]) => {
        if (!active) return;
        const scopes = (scopeRes.data ?? []) as GuruScope[];
        setPelajaranList((pelajaranRes.data ?? []).filter((item: Pelajaran) => scopes.some((scope) => scope.pelajaran_id === item.id)));
        setKelasList((kelasRes.data ?? []).filter((item: Kelas) => scopes.some((scope) => scope.kelas_id == null || scope.kelas_id === item.id)));
        setTopikList(topikRes.data ?? []);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Data soal belum bisa dimuat."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-text-muted">Memuat data...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">{editSoalId ? "Edit Soal" : "Buat Soal Baru"}</h1>
          <p className="mt-1 text-sm text-text-muted">Tulis soal, pilihan, dan kunci jawaban dalam satu formulir.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/guru/soal")}>Bank Soal</Button>
      </header>
      {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <SoalFormModal
        open
        presentation="page"
        editSoalId={editSoalId ? Number(editSoalId) : null}
        onClose={() => router.push("/guru/soal")}
        onCreated={() => router.push("/guru/soal")}
        pelajaranList={pelajaranList}
        kelasList={kelasList}
        topikList={topikList}
        defaultPelajaranId={defaultPelajaranId ? Number(defaultPelajaranId) : null}
        defaultKelasId={defaultKelasId ? Number(defaultKelasId) : null}
        defaultTopikId={defaultTopikId ? Number(defaultTopikId) : null}
        defaultSubbab={defaultSubbab}
        defaultTipe={defaultTipe}
        description="Soal baru disimpan sebagai draft dan dapat diajukan untuk review admin. Soal yang sudah disetujui langsung diperbarui tanpa review ulang."
      />
    </div>
  );
}
