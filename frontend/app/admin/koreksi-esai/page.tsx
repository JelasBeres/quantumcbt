"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Filter, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Button from "@/components/Button";
import Card from "@/components/Card";
import MathContent from "@/components/MathContent";
import DropdownSelect from "@/components/DropdownSelect";
import { PaketUjian } from "@/lib/types";

type JawabanEsai = {
  jawaban_id: number;
  ujian_siswa_id: number;
  siswa_id: number;
  nama_siswa: string;
  soal_id: number;
  teks_soal: string;
  jawaban_teks?: string | null;
  skor_manual?: number | null;
  dinilai_at?: string | null;
};

export default function KoreksiEsaiPage() {
  const isGuru = getUser()?.role === "guru";
  const [items, setItems] = useState<JawabanEsai[]>([]);
  const [paketList, setPaketList] = useState<PaketUjian[]>([]);
  const [selectedPaket, setSelectedPaket] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cari, setCari] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | boolean> = {};
      if (selectedPaket) params.paket_ujian_id = selectedPaket;
      if (onlyPending) params.hanya_belum_dinilai = true;
      const [jawabanRes, paketRes] = await Promise.all([
        api.get("/jawaban-siswa/esai/koreksi", { params }),
        api.get("/paket-ujian/")
      ]);
      setItems(jawabanRes.data);
      setPaketList(paketRes.data);
      const initial: Record<number, string> = {};
      jawabanRes.data.forEach((item: JawabanEsai) => {
        initial[item.jawaban_id] = item.skor_manual != null ? String(item.skor_manual) : "";
      });
      setScores(initial);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Data koreksi gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaket, onlyPending]);

  // Pencarian di sisi klien: nama siswa, soal, jawaban, atau nomor ujian/soal.
  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLocaleLowerCase();
    if (!kata) return items;
    const tanpaTag = (html: string) => html.replace(/<[^>]*>/g, " ");
    return items.filter((item) =>
      [item.nama_siswa, tanpaTag(item.teks_soal), item.jawaban_teks ?? "", `#${item.ujian_siswa_id}`, `#${item.soal_id}`]
        .join(" ")
        .toLocaleLowerCase()
        .includes(kata)
    );
  }, [items, cari]);

  const simpanNilai = async (item: JawabanEsai) => {
    const raw = scores[item.jawaban_id];
    const nilai = Number(raw);
    if (raw === "" || Number.isNaN(nilai) || nilai < 0 || nilai > 100) {
      setError("Skor harus berupa angka 0 sampai 100.");
      return;
    }
    setSavingId(item.jawaban_id);
    setError("");
    try {
      await api.patch(`/jawaban-siswa/${item.jawaban_id}/nilai`, { skor_manual: nilai });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Nilai gagal disimpan.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Koreksi Esai</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isGuru ? "Beri nilai jawaban esai dan isian sesuai mapel yang diampu (skala 0-100)" : "Beri nilai jawaban esai dan isian siswa (skala 0-100)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-56">
            <DropdownSelect
              value={selectedPaket}
              onChange={setSelectedPaket}
              searchPlaceholder="Cari paket..."
              options={[
                { value: "", label: "Semua paket ujian" },
                ...paketList.map((p) => ({ value: p.id, label: p.nama }))
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-body-dark">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="h-4 w-4 rounded border-card-border text-brand-primary focus:ring-brand-primary"
            />
            <Filter className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Hanya belum dinilai
          </label>
        </div>
      </div>

      {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!loading && items.length > 0 && (
        <label className="flex items-center gap-2 rounded-input border border-card-border bg-card-bg px-3.5 py-2.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/25">
          <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama siswa, soal, atau jawaban..."
            aria-label="Cari jawaban esai"
            className="w-full bg-transparent text-sm text-body-dark outline-none"
          />
        </label>
      )}

      {loading ? (
        <Card><p className="py-8 text-center text-text-muted">Memuat jawaban...</p></Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-text-muted">
            <ClipboardCheck className="mx-auto h-8 w-8" aria-hidden="true" />
            <p className="mt-2 text-sm">Tidak ada jawaban esai yang perlu dikoreksi.</p>
          </div>
        </Card>
      ) : hasilCari.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-text-muted">Tidak ada jawaban yang cocok dengan &ldquo;{cari.trim()}&rdquo;.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {cari.trim() && <p className="text-xs text-text-muted">{hasilCari.length} dari {items.length} jawaban</p>}
          {hasilCari.map((item) => (
            <Card key={item.jawaban_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-heading-dark">{item.nama_siswa}</p>
                  <p className="text-xs text-text-muted">Ujian #{item.ujian_siswa_id} · Soal #{item.soal_id}</p>
                </div>
                {item.skor_manual != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Dinilai {item.skor_manual}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Belum dinilai</span>
                )}
              </div>

              <div className="mt-4 rounded-input border border-card-border bg-neutral p-4">
                <p className="mb-1 text-xs font-medium text-text-muted">Soal:</p>
                <MathContent className="prose prose-sm max-w-none" html={item.teks_soal} />
              </div>

              <div className="mt-3 rounded-input border border-card-border bg-card-bg p-4">
                <p className="mb-1 text-xs font-medium text-text-muted">Jawaban siswa:</p>
                <p className="whitespace-pre-wrap text-sm text-body-dark">{item.jawaban_teks || "(kosong)"}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scores[item.jawaban_id] ?? ""}
                  onChange={(e) => setScores({ ...scores, [item.jawaban_id]: e.target.value })}
                  placeholder="Skor 0-100"
                  className="w-36 rounded-input border border-card-border bg-card-bg px-3 py-2 text-sm text-body-dark outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
                />
                <Button
                  size="sm"
                  disabled={savingId === item.jawaban_id}
                  onClick={() => simpanNilai(item)}
                >
                  {savingId === item.jawaban_id ? "Menyimpan..." : "Simpan Nilai"}
                </Button>
                {item.dinilai_at && (
                  <span className="text-xs text-text-muted">
                    Terakhir dinilai {new Date(item.dinilai_at).toLocaleString("id-ID")}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
