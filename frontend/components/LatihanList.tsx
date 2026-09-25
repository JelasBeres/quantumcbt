"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Card from "@/components/Card";

type Latihan = { id: number; nama: string; deskripsi?: string; durasi_menit: number; jumlah_soal: number; kategori?: string | null; kategori_nama?: string | null; bagian?: { bagian_id: number; nama: string; pelajaran_id?: number | null }[] };
export default function LatihanList() {
  const router = useRouter();
  const [items, setItems] = useState<Latihan[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    api.get("/siswa/latihan").then((r) => setItems(r.data)).catch((e) => setError(getErrorMessage(e, "Latihan gagal dimuat"))).finally(() => setLoading(false));
  }, []);
  const start = async (item: Latihan, mode: "latihan" | "drill") => {
    setBusy(item.id); setError("");
    try {
      const { data } = await api.post("/ujian-siswa/mulai-latihan", { paket_ujian_id: item.id, mode });
      router.push(`/siswa/ujian/${data.ujian_siswa_id}`);
    } catch (e) { setError(getErrorMessage(e, "Latihan gagal dimulai")); setBusy(null); }
  };
  return <section className="my-6 space-y-4">
    <h2 className="text-xl font-bold">Latihan mandiri</h2>
    <p className="text-sm text-text-muted">Tersedia kapan saja tanpa jadwal. Bisa diulang setelah selesai dan tidak masuk riwayat Try Out.</p>
    <Input label="Cari latihan" value={query} onChange={(e) => setQuery(e.target.value)} />
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p>Memuat latihan...</p> : <div className="grid gap-4 sm:grid-cols-2">{items.filter((i) => `${i.nama} ${i.deskripsi ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((item) => <Card key={item.id} title={item.nama}>
      <p className="mb-3 text-sm">{item.kategori_nama || (item.kategori ? item.kategori.toUpperCase().replace("_", " ") : "Belum dikategorikan")}
 · {item.jumlah_soal} soal · {item.durasi_menit} menit</p>
      {item.bagian && item.bagian.length > 0 && <p className="mb-3 text-xs text-text-muted">Mapel: {item.bagian.map((bagian) => bagian.nama).join(", ")}</p>}
      <p className="mb-3 text-sm text-text-muted">Mode Ujian memakai timer; pembahasan setelah selesai. Drilling tanpa timer; konfirmasi per soal untuk melihat pembahasan.</p><div className="flex gap-2"><Button disabled={busy !== null} onClick={() => start(item, "latihan")}>{busy === item.id ? "Membuka..." : "Mode Ujian"}</Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => start(item, "drill")}>Mode Drilling</Button></div>
    </Card>)}</div>}
    {!loading && items.length === 0 && <p>Belum ada latihan untuk program dan kelas Anda.</p>}
  </section>;
}
