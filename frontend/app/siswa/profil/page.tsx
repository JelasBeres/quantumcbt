"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, getErrorMessage } from "@/lib/api";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

type PilihanJurusan = { jurusan: string; universitas: string };
type Akademik = { no_induk?: string | null; program_nama?: string | null; kelas_nama?: string | null };

export default function ProfilSiswaPage() {
  const [nama, setNama] = useState("");
  const [sekolah, setSekolah] = useState("");
  const [choices, setChoices] = useState<PilihanJurusan[]>([]);
  const [akademik, setAkademik] = useState<Akademik>({});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/siswa/profil");
      setNama(data.nama_lengkap);
      setSekolah(data.sekolah || "");
      setChoices(data.pilihan_jurusan ?? []);
      setAkademik({ no_induk: data.no_induk, program_nama: data.program_nama, kelas_nama: data.kelas_nama });
      setReady(true);
    } catch (err) {
      setError(getErrorMessage(err, "Profil belum dapat dimuat. Silakan coba lagi."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function updateChoice(index: number, field: keyof PilihanJurusan, value: string) {
    setChoices((current) => current.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, [field]: value } : choice));
    setSuccess("");
  }

  function addChoice() {
    setChoices((current) => current.length < 3 ? [...current, { jurusan: "", universitas: "" }] : current);
    setSuccess("");
  }

  function removeChoice(index: number) {
    setChoices((current) => current.filter((_, choiceIndex) => choiceIndex !== index));
    setSuccess("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!nama.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    if (choices.some((choice) => !choice.jurusan.trim() || !choice.universitas.trim())) {
      setError("Jurusan dan universitas wajib diisi pada setiap pilihan.");
      return;
    }
    if (choices.length > 3) {
      setError("Maksimal 3 pilihan jurusan.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nama_lengkap: nama.trim(),
        sekolah: sekolah.trim() || null,
        pilihan_jurusan: choices.map((choice) => ({ jurusan: choice.jurusan.trim(), universitas: choice.universitas.trim() })),
      };
      const { data } = await api.patch("/siswa/profil", payload);
      setNama(data.nama_lengkap);
      setSekolah(data.sekolah || "");
      setChoices(data.pilihan_jurusan ?? []);
      setSuccess("Profil berhasil disimpan.");
    } catch (err) {
      setError(getErrorMessage(err, "Profil gagal disimpan. Silakan coba lagi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-5xl">
      <h1 className="text-2xl font-bold text-heading-dark">Profil Saya</h1>
      <div className="space-y-5 lg:flex lg:items-start lg:gap-5 lg:space-y-0">
        <Card className="lg:min-w-0 lg:flex-1" title="Data diri dan pilihan jurusan">
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="mb-4 text-sm text-green-700">{success}</p>}
        {loading ? <p role="status">Memuat profil...</p> : !ready ? (
          <Button onClick={() => void load()}>Coba lagi</Button>
        ) : (
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-3 rounded-input border border-card-border bg-neutral p-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">No. Induk</p>
                <p className="mt-0.5 text-sm font-medium text-heading-dark">{akademik.no_induk || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Program</p>
                <p className="mt-0.5 text-sm font-medium text-heading-dark">{akademik.program_nama || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Kelas</p>
                <p className="mt-0.5 text-sm font-medium text-heading-dark">{akademik.kelas_nama || "-"}</p>
              </div>
            </div>
            <Input label="Nama lengkap" aria-label="Nama lengkap" autoComplete="name" required maxLength={200}
              value={nama} onChange={(e) => { setNama(e.target.value); setSuccess(""); }} disabled={saving} />
            <Input label="Sekolah" aria-label="Sekolah" placeholder="Nama sekolah Anda" maxLength={200}
              value={sekolah} onChange={(e) => { setSekolah(e.target.value); setSuccess(""); }} disabled={saving} />
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-heading-dark">Pilihan jurusan</p>
                <p className="text-sm text-text-muted">Tambahkan hingga 3 pilihan. Jurusan dan universitas wajib diisi berpasangan.</p>
              </div>
              {choices.map((choice, index) => (
                <div key={index} className="rounded-input border border-card-border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label={`Jurusan pilihan ${index + 1}`} aria-label={`Jurusan pilihan ${index + 1}`} maxLength={200}
                      value={choice.jurusan} onChange={(e) => updateChoice(index, "jurusan", e.target.value)} disabled={saving} />
                    <Input label={`Universitas pilihan ${index + 1}`} aria-label={`Universitas pilihan ${index + 1}`} maxLength={200}
                      value={choice.universitas} onChange={(e) => updateChoice(index, "universitas", e.target.value)} disabled={saving} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => removeChoice(index)} disabled={saving}>
                    Hapus pilihan
                  </Button>
                </div>
              ))}
              {choices.length < 3 && <Button type="button" variant="outline" size="sm" onClick={addChoice} disabled={saving}>Tambah pilihan</Button>}
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan profil"}</Button>
          </form>
        )}
        </Card>
        <Card className="lg:w-80 lg:flex-none" title="Password">
          <p className="mb-3 text-sm text-text-muted">Password adalah pengaturan yang dapat Anda ubah melalui halaman keamanan akun.</p>
          <Link href="/change-password" className="font-semibold text-brand-primary underline">Ganti password</Link>
        </Card>
      </div>
    </main>
  );
}
