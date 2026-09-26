"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import SoalFormModal from "@/components/SoalFormModal";
import { api } from "@/lib/api";
import { Kelas, Pelajaran, Topik } from "@/lib/types";
import { kembaliAtau } from "@/lib/posisi-bank-soal";

export default function TambahSoalPage() {
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

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/pelajaran/"), api.get("/kelas/"), api.get("/topik/")])
      .then(([pelajaranRes, kelasRes, topikRes]) => {
        if (!active) return;
        setPelajaranList(pelajaranRes.data);
        setKelasList(kelasRes.data);
        setTopikList(topikRes.data);
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
          <h1 className="text-3xl font-bold text-heading-dark">{editSoalId ? "Edit Soal" : "Tambah Soal"}</h1>
          <p className="mt-1 text-sm text-text-muted">Tulis soal, pilihan, dan kunci jawaban dalam satu formulir.</p>
        </div>
        <button type="button" onClick={() => router.push("/admin/soal")} className="inline-flex items-center justify-center rounded-btn bg-brand-primary px-4 py-2 text-sm font-semibold text-heading-light transition hover:bg-brand-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">Bank Soal</button>
      </header>
      <SoalFormModal
        open
        presentation="page"
        editSoalId={editSoalId ? Number(editSoalId) : null}
        onClose={() => kembaliAtau(router, "/admin/soal")}
        onCreated={() => kembaliAtau(router, "/admin/soal")}
        pelajaranList={pelajaranList}
        kelasList={kelasList}
        topikList={topikList}
        defaultPelajaranId={defaultPelajaranId ? Number(defaultPelajaranId) : null}
        defaultKelasId={defaultKelasId ? Number(defaultKelasId) : null}
        defaultTopikId={defaultTopikId ? Number(defaultTopikId) : null}
        defaultSubbab={defaultSubbab}
        defaultTipe={defaultTipe}
        description={
          editSoalId
            ? "Perubahan soal akan langsung disimpan."
            : "Soal yang ditambahkan admin langsung berstatus approved dan siap digunakan di paket ujian."
        }
      />
    </div>
  );
}
