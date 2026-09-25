"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Inbox, Pencil } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Button from "@/components/Button";
import Card from "@/components/Card";
import MathContent from "@/components/MathContent";

type Laporan = {
  id: number;
  soal_id: number;
  user_id?: number | null;
  alasan?: string | null;
  status?: string | null;
  created_at?: string | null;
  teks_soal?: string | null;
  nama_pelapor?: string | null;
  soal_status?: string | null;
  soal_created_by?: number | null;
};

export default function LaporanSoalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: number | null; isGuru: boolean }>({ id: null, isGuru: false });
  const isGuru = currentUser.isGuru;
  const [items, setItems] = useState<Laporan[]>([]);
  const [status, setStatus] = useState("baru");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/laporan-soal", { params: { status } });
      setItems(res.data);
    } catch (err: any) {
      setError(getErrorMessage(err, "Laporan gagal dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getUser();
    setCurrentUser({ id: user?.id ?? null, isGuru: user?.role === "guru" });
  }, []);

  useEffect(() => {
    load();
  }, [status]);

  // Admin selalu bisa mengedit langsung. Guru mengedit langsung draft/perlu revisi
  // miliknya sendiri, dan (revisi 25 Sep) soal approved milik siapa pun dalam
  // penugasannya tanpa membuat soal baru atau review ulang.
  const canEdit = (item: Laporan): boolean => {
    if (!isGuru) return true;
    const own = currentUser.id !== null && item.soal_created_by === currentUser.id;
    if (own && (item.soal_status === "draft" || item.soal_status === "rejected")) return true;
    return item.soal_status === "approved";
  };

  const editSoal = (item: Laporan) => {
    if (!canEdit(item)) return;
    router.push(isGuru ? `/guru/soal/tambah?id=${item.soal_id}` : `/admin/tambah-soal?id=${item.soal_id}`);
  };

  const editHint = (item: Laporan) => {
    if (item.soal_status === "pending_review") return "Soal sedang menunggu review admin.";
    return "Soal tidak dapat diedit dari akun ini.";
  };

  const tandaiSelesai = async (item: Laporan) => {
    setSavingId(item.id);
    try {
      await api.patch(`/laporan-soal/${item.id}/status`, { status: "selesai" });
      await load();
    } catch (err: any) {
      setError(getErrorMessage(err, "Gagal mengubah status."));
    } finally {
      setSavingId(null);
    }
  };

  return (
<main className="min-h-screen bg-transparent px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-semibold text-brand-primary">Bank Soal</p>
          <h1 className="mt-1 text-3xl font-bold text-heading-dark">Laporan Soal</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isGuru ? "Laporan siswa untuk soal sesuai mapel yang diampu." : "Laporan dari siswa tentang soal yang bermasalah."}
          </p>
        </div>

        <div className="flex gap-2">
          {["baru", "selesai"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                status === s
                  ? "bg-brand-primary text-heading-light"
                  : "border-2 border-card-border bg-card-bg text-body-dark hover:border-brand-primary"
              }`}
            >
              {s === "baru" ? "Baru" : "Selesai"}
            </button>
          ))}
        </div>

        {error && <div className="rounded-input border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {loading ? (
          <Card><p className="text-sm text-text-muted">Memuat laporan...</p></Card>
        ) : items.length === 0 ? (
          <Card>
            <div className="py-10 text-center text-text-muted">
              <Inbox className="mx-auto h-8 w-8" aria-hidden="true" />
              <p className="mt-2 text-sm">Tidak ada laporan {status === "baru" ? "baru" : "yang selesai"}.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-700">
                      <Flag className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-heading-dark">Soal #{item.soal_id}</p>
                      <p className="text-xs text-text-muted">
                        {item.nama_pelapor || "Anonim"}
                        {item.created_at ? ` · ${new Date(item.created_at).toLocaleString("id-ID")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit(item) ? (
                      <Button size="sm" variant="outline" disabled={savingId === item.id} onClick={() => editSoal(item)}>
                        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" /> Edit Soal
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted">{editHint(item)}</span>
                    )}
                    {item.status === "baru" && (
                      <Button size="sm" disabled={savingId === item.id} onClick={() => tandaiSelesai(item)}>
                        {savingId === item.id ? "Menyimpan..." : "Tandai Selesai"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-input border border-card-border bg-neutral p-3">
                  <MathContent className="prose prose-sm max-w-none line-clamp-2" html={item.teks_soal || ""} />
                </div>

                {item.alasan && (
                  <div className="mt-3 rounded-input border border-card-border bg-card-bg p-3">
                    <p className="text-xs font-medium text-text-muted">Alasan pelaporan:</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-body-dark">{item.alasan}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

