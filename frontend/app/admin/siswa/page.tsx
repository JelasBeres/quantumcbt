"use client";

import { useEffect, useState, FormEvent } from "react";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Table from "@/components/Table";
import { Siswa, Program } from "@/lib/types";
import { useAppDialog } from "@/components/Dialog";
import ImportSiswaCsv from "@/components/ImportSiswaCsv";

type Kelas = {
  id: number;
  nama: string;
};

export default function SiswaPage() {
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState<Siswa | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const { showConfirm, dialog } = useAppDialog();
  const emptyChoices = () => Array.from({ length: 3 }, () => ({ jurusan: "", universitas: "" }));
  const [choices, setChoices] = useState(emptyChoices);
  const [formData, setFormData] = useState({
    user_id: "",
    nama_lengkap: "",
    sekolah: "",
    username: "",
    password: "",
    no_induk: "",
    program_id: "",
    kelas_id: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [siswaRes, programsRes, kelasRes] = await Promise.all([
        api.get("/siswa/"),
        api.get("/program/"),
        api.get("/kelas/")
      ]);
      setSiswa(siswaRes.data);
      setPrograms(programsRes.data);
      setKelas(kelasRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (choices.some((c) => !!c.jurusan.trim() !== !!c.universitas.trim())) { setError("Isi jurusan dan universitas sebagai pasangan."); return; }
    if (!formData.program_id) {
      setError("Program wajib diisi. Setiap siswa harus memiliki program.");
      return;
    }
    try {
      if (editingId) {
        const payload = {
          user_id: Number(formData.user_id),
          nama_lengkap: formData.nama_lengkap,
          sekolah: formData.sekolah.trim() || null,
          pilihan_jurusan: choices.filter((c) => c.jurusan.trim()).map((c) => ({ jurusan: c.jurusan.trim(), universitas: c.universitas.trim() })),
          no_induk: formData.no_induk || null,
          program_id: formData.program_id ? Number(formData.program_id) : null,
          kelas_id: formData.kelas_id ? Number(formData.kelas_id) : null
        };
        await api.put(`/siswa/${editingId}`, payload);
      } else {
        const payload = {
          nama_lengkap: formData.nama_lengkap,
          sekolah: formData.sekolah.trim() || null,
          pilihan_jurusan: choices.filter((c) => c.jurusan.trim()).map((c) => ({ jurusan: c.jurusan.trim(), universitas: c.universitas.trim() })),
          username: formData.username.trim(),
          password: formData.password,
          no_induk: formData.no_induk || null,
          program_id: formData.program_id ? Number(formData.program_id) : null,
          kelas_id: formData.kelas_id ? Number(formData.kelas_id) : null
        };
        await api.post("/siswa/register", payload);
      }
      loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal menyimpan data siswa.");
    }
  };

  const handleEdit = (item: Siswa) => {
    setChoices(emptyChoices().map((c, i) => item.pilihan_jurusan?.[i] ?? c));
    setFormData({
      user_id: String(item.user_id),
      nama_lengkap: item.nama_lengkap,
      sekolah: item.sekolah || "",
      username: "",
      password: "",
      no_induk: item.no_induk || "",
      program_id: item.program_id ? String(item.program_id) : "",
      kelas_id: item.kelas_id ? String(item.kelas_id) : ""
    });
    setEditingId(item.id);
    setResetTarget(null);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: "Hapus Siswa",
      description: "Data siswa ini akan dihapus dari daftar.",
      confirmLabel: "Hapus Siswa",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/siswa/${id}`);
      loadData();
    } catch (error) {
      console.error("Failed to delete siswa:", error);
    }
  };

  const openReset = (item: Siswa) => {
    resetForm();
    setShowImport(false);
    setResetTarget(item);
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetSuccess("");
    if (resetPassword.length < 8) {
      setResetError("Password baru minimal 8 karakter.");
      return;
    }
    if (!/[A-Z]/.test(resetPassword) || !/[a-z]/.test(resetPassword) || !/[0-9]/.test(resetPassword)) {
      setResetError("Password harus mengandung huruf besar, huruf kecil, dan angka.");
      return;
    }
    setResetting(true);
    try {
      await api.post("/auth/reset-password", { user_id: resetTarget.user_id, new_password: resetPassword });
      setResetSuccess(`Password untuk ${resetTarget.nama_lengkap}${resetTarget.username ? ` (${resetTarget.username})` : ""} berhasil di-reset. Siswa perlu login ulang dengan password baru.`);
      setResetPassword("");
    } catch (err) {
      setResetError(getErrorMessage(err, "Gagal reset password."));
    } finally {
      setResetting(false);
    }
  };

  const resetForm = () => {
    setChoices(emptyChoices());
    setFormData({ user_id: "", nama_lengkap: "", sekolah: "", username: "", password: "", no_induk: "", program_id: "", kelas_id: "" });
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const getProgramName = (programId: number | null | undefined) => {
    if (!programId) return "-";
    const program = programs.find(p => p.id === programId);
    return program ? program.nama : "-";
  };

  const getKelasName = (kelasId: number | null | undefined) => {
    if (!kelasId) return "-";
    const kelasItem = kelas.find(k => k.id === kelasId);
    return kelasItem ? kelasItem.nama : "-";
  };

  const columns = [
    { header: "No. Induk", accessor: "no_induk" as keyof Siswa },
    { header: "Nama Lengkap", accessor: "nama_lengkap" as keyof Siswa },
    { header: "Username", accessor: (row: Siswa) => <span className="font-mono text-xs">{row.username || "-"}</span> },
    { header: "Sekolah", accessor: "sekolah" as keyof Siswa },
    {
      header: "Program",
      accessor: (row: Siswa) => getProgramName(row.program_id)
    },
    {
      header: "Kelas",
      accessor: (row: Siswa) => getKelasName(row.kelas_id)
    },
    {
      header: "Aksi",
      accessor: (row: Siswa) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => openReset(row)}>
            Reset Password
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>
            Hapus
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-heading-dark">Siswa</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola data siswa</p>
        </div>
        {!showForm && !showImport && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              Import CSV
            </Button>
            <Button onClick={() => setShowForm(true)}>
              Tambah Siswa
            </Button>
          </div>
        )}
      </div>

      {showImport && (
        <ImportSiswaCsv
          programNames={programs.map((p) => p.nama)}
          kelasNames={kelas.map((k) => k.nama)}
          onClose={() => setShowImport(false)}
          onImported={loadData}
        />
      )}

      {showForm && (
        <Card
          title={editingId ? "Edit Siswa" : "Tambah Siswa"}
          action={
            <Button variant="outline" size="sm" onClick={resetForm}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Lengkap"
              required
              value={formData.nama_lengkap}
              onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
              placeholder="Nama lengkap siswa"
            />
            <div className="space-y-3"><p className="font-semibold">Pilihan jurusan (ditentukan admin)</p>{choices.map((choice, index) => <div key={index} className="grid gap-3 sm:grid-cols-2"><Input label={`Jurusan pilihan ${index + 1}`} maxLength={200} value={choice.jurusan} onChange={(e) => setChoices(choices.map((c, i) => i === index ? { ...c, jurusan: e.target.value } : c))} /><Input label={`Universitas pilihan ${index + 1}`} maxLength={200} value={choice.universitas} onChange={(e) => setChoices(choices.map((c, i) => i === index ? { ...c, universitas: e.target.value } : c))} /></div>)}</div>
            <Input label="Sekolah" aria-label="Sekolah" maxLength={200}
              value={formData.sekolah}
              onChange={(e) => setFormData({ ...formData, sekolah: e.target.value })}
              placeholder="Nama sekolah siswa" />
            {!editingId && (
              <>
                <Input
                  label="Username (untuk login siswa)"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Contoh: budi.santoso"
                />
                <Input
                  label="Password (untuk login siswa)"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                />
              </>
            )}
            {editingId && (
              <p className="rounded-input border border-card-border bg-neutral p-3 text-sm text-text-muted">
                Username tidak diubah di sini. Untuk mengganti password, gunakan tombol Reset Password di daftar siswa.
              </p>
            )}
            <Input
              label="No. Induk"
              value={formData.no_induk}
              onChange={(e) => setFormData({ ...formData, no_induk: e.target.value })}
              placeholder="NIS/NISN"
            />
            <Select
              label="Program"
              required
              value={formData.program_id}
              onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
              options={[
                { value: "", label: "- Pilih Program (wajib) -" },
                ...programs.map(p => ({ value: p.id, label: p.nama }))
              ]}
            />
            <Select
              label="Kelas"
              value={formData.kelas_id}
              onChange={(e) => setFormData({ ...formData, kelas_id: e.target.value })}
              options={[
                { value: "", label: "- Pilih Kelas -" },
                ...kelas.map(k => ({ value: k.id, label: k.nama }))
              ]}
            />
            {error && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {editingId ? "Simpan Perubahan" : "Tambah Siswa"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {resetTarget && (
        <Card
          title={`Reset Password: ${resetTarget.nama_lengkap}`}
          action={<Button variant="outline" size="sm" onClick={closeReset} disabled={resetting}>Tutup</Button>}
        >
          <form onSubmit={handleResetSubmit} className="space-y-4">
            {resetError && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{resetError}</div>}
            {resetSuccess && <div className="rounded-input border border-green-200 bg-green-50 p-3 text-sm text-green-700">{resetSuccess}</div>}
            <p className="text-sm text-text-muted">
              Username login: <span className="font-mono font-semibold text-body-dark">{resetTarget.username || "-"}</span>. Setelah di-reset, sampaikan password baru ke siswa.
            </p>
            <Input
              label="Password Baru"
              type="password"
              required
              autoComplete="new-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Min. 8 karakter, huruf besar/kecil & angka"
              disabled={resetting}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={resetting || !resetPassword}>{resetting ? "Menyimpan..." : "Reset Password"}</Button>
              <Button type="button" variant="outline" onClick={closeReset} disabled={resetting}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table paginate newestFirst searchText={(row) => [row.nama_lengkap, row.username, row.no_induk, row.sekolah, getProgramName(row.program_id), getKelasName(row.kelas_id)].filter(Boolean).join(" ")} data={siswa} columns={columns} emptyMessage="Belum ada siswa. Klik 'Tambah Siswa' untuk mendaftarkan murid." />
      </Card>
      {dialog}
    </div>
  );
}
