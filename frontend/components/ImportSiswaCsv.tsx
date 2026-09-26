"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Download, FileUp, RotateCcw } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { useAppDialog } from "@/components/Dialog";
import { api, getErrorMessage } from "@/lib/api";

type StatusBaris = "siap" | "dilewati" | "error";
type Baris = {
  baris: number;
  status: StatusBaris;
  pesan: string;
  nama_lengkap: string;
  username: string;
  no_induk?: string | null;
  program: string;
  kelas: string;
};
type Preview = { siap: number; dilewati: number; error: number; baris: Baris[] };

const HEADER = ["nama_lengkap", "username", "password", "no_induk", "sekolah", "program", "kelas", "jurusan_1", "universitas_1", "jurusan_2", "universitas_2", "jurusan_3", "universitas_3"];

const LABEL_STATUS: Record<StatusBaris, { teks: string; kelas: string }> = {
  siap: { teks: "Siap diimpor", kelas: "border-green-200 bg-green-50 text-green-700" },
  dilewati: { teks: "Dilewati (sudah ada)", kelas: "border-amber-200 bg-amber-50 text-amber-800" },
  error: { teks: "Perlu diperbaiki", kelas: "border-red-200 bg-red-50 text-red-700" },
};

function csvCell(value: string) {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function ImportSiswaCsv({ programNames, kelasNames, onClose, onImported }: {
  programNames: string[];
  kelasNames: string[];
  onClose: () => void;
  onImported: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasil, setHasil] = useState("");
  const [tampil, setTampil] = useState<StatusBaris | "semua">("semua");
  const { showConfirm, dialog } = useAppDialog();

  const downloadTemplate = () => {
    const contoh = ["Budi Santoso", "budi.santoso", "Rahasia123", "2026001", "SMA Negeri 1", programNames[0] ?? "Nama Program", kelasNames[0] ?? "", "Kedokteran", "Universitas Indonesia", "", "", "", ""];
    const csv = [HEADER, contoh].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-import-siswa.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const kirim = (endpoint: string, target: File) => {
    const formData = new FormData();
    formData.append("file", target);
    return api.post(endpoint, formData, { timeout: 120000 });
  };

  const pilihFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFile(target);
    setPreview(null);
    setHasil("");
    setError("");
    setTampil("semua");
    if (!target) return;
    setBusy(true);
    try {
      const { data } = await kirim("/siswa/import/preview", target);
      setPreview(data);
    } catch (err) {
      setError(getErrorMessage(err, "File gagal diperiksa."));
    } finally {
      setBusy(false);
    }
  };

  const importSekarang = async () => {
    if (!file || !preview || preview.siap === 0) return;
    const catatan = [
      preview.dilewati ? `${preview.dilewati} baris dilewati karena username/no. induk sudah terdaftar (data lama tidak diubah).` : "",
      preview.error ? `${preview.error} baris bermasalah TIDAK ikut diimpor.` : "",
    ].filter(Boolean).join(" ");
    const yakin = await showConfirm({
      title: `Import ${preview.siap} siswa?`,
      description: `Sebanyak ${preview.siap} akun siswa baru akan dibuat dari file "${file.name}" dan langsung bisa dipakai login. ${catatan} Pastikan data sudah benar sebelum melanjutkan.`,
      confirmLabel: `Ya, import ${preview.siap} siswa`,
      cancelLabel: "Periksa lagi",
    });
    if (!yakin) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await kirim("/siswa/import", file);
      setHasil(`${data.berhasil} siswa berhasil diimpor${data.dilewati ? `, ${data.dilewati} dilewati` : ""}${data.error ? `, ${data.error} bermasalah` : ""}.`);
      setPreview(null);
      setFile(null);
      await onImported();
    } catch (err) {
      setError(getErrorMessage(err, "Import siswa gagal. Tidak ada data yang disimpan."));
    } finally {
      setBusy(false);
    }
  };

  const barisTampil = preview ? preview.baris.filter((row) => tampil === "semua" || row.status === tampil) : [];

  return (
    <Card
      title="Import Siswa dari CSV"
      action={<Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>}
    >
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-muted">
          <li>Download template, isi satu siswa per baris (bisa dibuka di Excel / Google Sheets), simpan sebagai CSV.</li>
          <li>Kolom wajib: <b>nama_lengkap, username, password, program</b>. Nama program & kelas harus sama dengan yang ada di sistem.</li>
          <li>Upload file, periksa hasilnya, lalu konfirmasi import. Maksimal 300 siswa per file.</li>
        </ol>
        <p className="rounded-input border border-card-border bg-neutral/40 p-3 text-xs text-text-muted">
          <b>Anti-duplikasi:</b> siswa yang username atau no. induknya sudah terdaftar otomatis dilewati (data lama tidak ditimpa),
          dan username/no. induk yang dobel di dalam file ditandai error. Upload file yang sama dua kali tidak akan membuat siswa ganda.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Download Template
          </Button>
          <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1.5 h-4 w-4" aria-hidden="true" /> {file ? "Ganti File CSV" : "Upload File CSV"}
          </Button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pilihFile} />
        </div>

        {busy && <p className="text-sm text-text-muted">{preview ? "Mengimpor siswa, mohon tunggu..." : "Memeriksa file..."}</p>}
        {error && <div role="alert" className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {hasil && <div role="status" className="rounded-input border border-green-200 bg-green-50 p-3 text-sm text-green-700">{hasil}</div>}

        {preview && file && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-heading-dark">Hasil pemeriksaan: {file.name} ({preview.baris.length} baris)</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tampilkan baris">
              {([["semua", `Semua ${preview.baris.length}`], ["siap", `Siap ${preview.siap}`], ["dilewati", `Dilewati ${preview.dilewati}`], ["error", `Perlu diperbaiki ${preview.error}`]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={tampil === key} onClick={() => setTampil(key)}
                  className={`rounded-btn border px-3 py-1.5 text-sm font-semibold transition ${tampil === key ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-card-border bg-card-bg text-text-muted hover:text-body-dark"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-auto rounded-input border border-card-border">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead className="sticky top-0 bg-neutral text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <tr><th className="px-3 py-2">Baris</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">No. Induk</th><th className="px-3 py-2">Program / Kelas</th><th className="px-3 py-2">Status</th></tr>
                </thead>
                <tbody>
                  {barisTampil.map((row) => (
                    <tr key={row.baris} className="border-t border-card-border align-top">
                      <td className="px-3 py-2 text-text-muted">{row.baris}</td>
                      <td className="px-3 py-2">{row.nama_lengkap || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.username || "-"}</td>
                      <td className="px-3 py-2">{row.no_induk || "-"}</td>
                      <td className="px-3 py-2">{row.program || "-"}{row.kelas ? ` / ${row.kelas}` : ""}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${LABEL_STATUS[row.status].kelas}`}>{LABEL_STATUS[row.status].teks}</span>
                        {row.pesan && <p className="mt-1 text-xs text-text-muted">{row.pesan}</p>}
                      </td>
                    </tr>
                  ))}
                  {barisTampil.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-text-muted">Tidak ada baris.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {preview.error > 0 && <p className="mr-auto text-xs text-text-muted">Perbaiki baris bermasalah di file lalu upload ulang, atau lanjutkan tanpa baris tersebut.</p>}
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setFile(null); setPreview(null); }}>
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Batal
              </Button>
              <Button type="button" disabled={busy || preview.siap === 0} onClick={importSekarang}>
                {preview.siap === 0 ? "Tidak ada siswa baru" : `Import ${preview.siap} Siswa`}
              </Button>
            </div>
          </div>
        )}
      </div>
      {dialog}
    </Card>
  );
}
