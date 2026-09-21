"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Table from "@/components/Table";
import { Kelas, Pelajaran, Program } from "@/lib/types";
import { useAppDialog } from "@/components/Dialog";

type User = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
};
type GuruScopeInput = { pelajaran_id: string; program_id: string; kelas_id: string };
type GuruProfile = {
  id: number; user_id: number; username: string; is_active: boolean;
  nama_lengkap: string; nip?: string | null; email?: string | null; no_hp?: string | null;
  scopes: Array<{ id: number; pelajaran_id: number; program_id?: number | null; kelas_id?: number | null; pelajaran_nama: string; program_nama?: string | null; kelas_nama?: string | null }>;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  guru: "Guru",
  siswa: "Siswa",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("semua");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "", role: "siswa" });
  const [guruForm, setGuruForm] = useState({ nama_lengkap: "", nip: "", email: "", no_hp: "" });
  const [scopeRows, setScopeRows] = useState<GuruScopeInput[]>([{ pelajaran_id: "", program_id: "", kelas_id: "" }]);
  const [guruProfiles, setGuruProfiles] = useState<GuruProfile[]>([]);
  const [programList, setProgramList] = useState<Program[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [pelajaranList, setPelajaranList] = useState<Pelajaran[]>([]);
  const [guruDetail, setGuruDetail] = useState<GuruProfile | null>(null);
  const [editingGuru, setEditingGuru] = useState(false);
  const [editGuruForm, setEditGuruForm] = useState({ nama_lengkap: "", nip: "", email: "", no_hp: "" });
  const [editScopeRows, setEditScopeRows] = useState<GuruScopeInput[]>([]);
  const [savingGuru, setSavingGuru] = useState(false);
  const [guruEditError, setGuruEditError] = useState("");
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetting, setResetting] = useState(false);
  const { showAlert, showConfirm, dialog } = useAppDialog();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const [usersRes, profilesRes, programRes, kelasRes, pelajaranRes] = await Promise.all([
        api.get("/users/"), api.get("/guru-scope/profiles"), api.get("/program/"), api.get("/kelas/"), api.get("/pelajaran/")
      ]);
      setUsers(usersRes.data); setGuruProfiles(profilesRes.data ?? []); setProgramList(programRes.data ?? []); setKelasList(kelasRes.data ?? []); setPelajaranList(pelajaranRes.data ?? []);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (!/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError("Password harus mengandung huruf besar, huruf kecil, dan angka.");
      return;
    }
    try {
      if (formData.role === "guru") {
        if (!guruForm.nama_lengkap.trim()) { setError("Nama lengkap guru wajib diisi."); return; }
        if (scopeRows.some((scope) => !scope.pelajaran_id)) { setError("Setiap scope wajib memilih mata pelajaran."); return; }
        await api.post("/guru-scope/profiles", {
          username: formData.username, password: formData.password,
          nama_lengkap: guruForm.nama_lengkap, nip: guruForm.nip || null,
          email: guruForm.email || null, no_hp: guruForm.no_hp || null,
          scopes: scopeRows.map((scope) => ({ pelajaran_id: Number(scope.pelajaran_id), program_id: scope.program_id ? Number(scope.program_id) : null, kelas_id: scope.kelas_id ? Number(scope.kelas_id) : null }))
        });
      } else {
        await api.post("/auth/register", formData);
      }
      loadUsers();
      setFormData({ username: "", password: "", role: "siswa" });
      setGuruForm({ nama_lengkap: "", nip: "", email: "", no_hp: "" });
      setScopeRows([{ pelajaran_id: "", program_id: "", kelas_id: "" }]);
      setShowForm(false);
    } catch (error) {
      setError(getErrorMessage(error, "Gagal membuat user"));
    }
  };

  const openReset = (user: User) => {
    setResetTarget(user);
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
      await api.post("/auth/reset-password", {
        user_id: resetTarget.id,
        new_password: resetPassword
      });
      setResetSuccess(`Password untuk "${resetTarget.username}" berhasil di-reset.`);
      setResetPassword("");
    } catch (error) {
      setResetError(getErrorMessage(error, "Gagal reset password."));
    } finally {
      setResetting(false);
    }
  };

  const toggleActive = async (user: User) => {
    const action = user.is_active ? "menonaktifkan" : "mengaktifkan";
    const confirmed = await showConfirm({
      title: user.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun",
      description: `Yakin ${action} akun "${user.username}"? Pengguna ${user.is_active ? "tidak bisa login lagi" : "bisa login kembali"}.`,
      confirmLabel: user.is_active ? "Nonaktifkan" : "Aktifkan",
      confirmVariant: user.is_active ? "danger" : "primary"
    });
    if (!confirmed) return;
    try {
      await api.patch(`/users/${user.id}/status`, { is_active: !user.is_active });
      loadUsers();
    } catch (error) {
      showAlert({ title: "Gagal Mengubah Status", description: getErrorMessage(error, "Gagal mengubah status akun.") });
    }
  };

  const updateScopeRow = (index: number, patch: Partial<GuruScopeInput>) => {
    setScopeRows((prev) => prev.map((scope, i) => {
      if (i !== index) return scope;
      const next = { ...scope, ...patch };
      if (patch.program_id !== undefined) {
        const selected = pelajaranList.find((p) => p.id === Number(next.pelajaran_id));
        if (selected?.program_id && String(selected.program_id) !== patch.program_id) next.pelajaran_id = "";
      }
      return next;
    }));
  };

  const openGuruDetail = (profile: GuruProfile | null) => {
    if (!profile) { setError("Profil guru belum tersedia."); return; }
    setGuruDetail(profile); setEditingGuru(false); setGuruEditError("");
  };

  const startEditGuru = () => {
    if (!guruDetail) return;
    setEditGuruForm({ nama_lengkap: guruDetail.nama_lengkap, nip: guruDetail.nip ?? "", email: guruDetail.email ?? "", no_hp: guruDetail.no_hp ?? "" });
    setEditScopeRows(guruDetail.scopes.map((scope) => ({ pelajaran_id: String(scope.pelajaran_id), program_id: scope.program_id ? String(scope.program_id) : "", kelas_id: scope.kelas_id ? String(scope.kelas_id) : "" })));
    setEditingGuru(true); setGuruEditError("");
  };

  const updateEditScopeRow = (index: number, patch: Partial<GuruScopeInput>) => {
    setEditScopeRows((prev) => prev.map((scope, i) => i === index ? { ...scope, ...patch, ...(patch.program_id !== undefined ? { pelajaran_id: "" } : {}) } : scope));
  };

  const saveGuruProfile = async () => {
    if (!guruDetail) return;
    if (!editGuruForm.nama_lengkap.trim()) { setGuruEditError("Nama lengkap wajib diisi."); return; }
    if (editScopeRows.length === 0 || editScopeRows.some((scope) => !scope.pelajaran_id)) { setGuruEditError("Minimal satu scope dengan mata pelajaran wajib dipilih."); return; }
    setSavingGuru(true); setGuruEditError("");
    try {
      const response = await api.put(`/guru-scope/profiles/${guruDetail.user_id}`, {
        nama_lengkap: editGuruForm.nama_lengkap, nip: editGuruForm.nip || null, email: editGuruForm.email || null, no_hp: editGuruForm.no_hp || null,
        scopes: editScopeRows.map((scope) => ({ pelajaran_id: Number(scope.pelajaran_id), program_id: scope.program_id ? Number(scope.program_id) : null, kelas_id: scope.kelas_id ? Number(scope.kelas_id) : null }))
      });
      setGuruDetail(response.data); setEditingGuru(false); await loadUsers();
    } catch (err) { setGuruEditError(getErrorMessage(err, "Profil guru gagal diperbarui.")); }
    finally { setSavingGuru(false); }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-brand-primary/10 text-brand-primary",
      guru: "border border-blue-200 bg-blue-50 text-blue-800",
      siswa: "border border-green-200 bg-green-50 text-green-700",
    };
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[role] || "bg-neutral text-body-dark"}`}>
        {role}
      </span>
    );
  };

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { siswa: 0, admin: 0, guru: 0 };
    users.forEach((u) => {
      if (u.role in counts) counts[u.role] += 1;
    });
    return counts;
  }, [users]);

  const roleOptions = useMemo(
    () => [
      { value: "semua", label: "Semua", jumlah: users.length },
      { value: "siswa", label: "Siswa", jumlah: roleCounts.siswa },
      { value: "guru", label: "Guru", jumlah: roleCounts.guru },
      { value: "admin", label: "Admin", jumlah: roleCounts.admin },
    ].filter((item) => item.value === "semua" || item.jumlah > 0),
    [users, roleCounts]
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "semua" && user.role !== roleFilter) return false;
      if (!query) return true;
      const label = ROLE_LABEL[user.role]?.toLowerCase() ?? user.role.toLowerCase();
      return (
        user.username.toLowerCase().includes(query) ||
        String(user.id) === query ||
        label.includes(query)
      );
    });
  }, [users, roleFilter, searchQuery]);

  const columns = [
    { header: "ID", accessor: "id" as keyof User },
    { header: "Username", accessor: "username" as keyof User },
    {
      header: "Role",
      accessor: (row: User) => getRoleBadge(row.role)
    },
    {
      header: "Status",
      accessor: (row: User) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_active ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700"}`}>
          {row.is_active ? "Aktif" : "Nonaktif"}
        </span>
      )
    },
    {
      header: "Aksi",
      accessor: (row: User) => (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={row.is_active ? "danger" : "outline"}
            onClick={() => toggleActive(row)}
          >
            {row.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
           <Button size="sm" variant="outline" onClick={() => openReset(row)}>
             Reset Password
           </Button>
           {row.role === "guru" && (
             <Button size="sm" variant="outline" onClick={() => openGuruDetail(guruProfiles.find((g) => g.user_id === row.id) ?? null)}>
               Detail Guru
             </Button>
           )}
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
          <h1 className="text-3xl font-bold text-heading-dark">Users</h1>
          <p className="mt-1 text-sm text-text-muted">Kelola akun user</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            Tambah User
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title="Tambah User"
          action={
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setError(""); }}>
              Batal
            </Button>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Input
              label="Username"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Username"
            />
            <Input
              label="Password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min. 8 karakter, huruf besar/kecil & angka"
            />
            <Select
              label="Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={[
                { value: "siswa", label: "Siswa" },
                { value: "guru", label: "Guru" },
                { value: "admin", label: "Admin" }
              ]}
            />
            {formData.role === "guru" && (
              <div className="space-y-5 rounded-card border border-card-border bg-neutral/30 p-4">
                <div><h3 className="font-bold text-heading-dark">Profil Guru</h3><p className="text-sm text-text-muted">Data guru dan penugasan akademik dibuat bersama akun.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Nama Lengkap" required value={guruForm.nama_lengkap} onChange={(e) => setGuruForm({ ...guruForm, nama_lengkap: e.target.value })} />
                  <Input label="NIP / No. Identitas" value={guruForm.nip} onChange={(e) => setGuruForm({ ...guruForm, nip: e.target.value })} />
                  <Input label="Email" type="email" value={guruForm.email} onChange={(e) => setGuruForm({ ...guruForm, email: e.target.value })} />
                  <Input label="Nomor HP" value={guruForm.no_hp} onChange={(e) => setGuruForm({ ...guruForm, no_hp: e.target.value })} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-heading-dark">Penugasan Guru</h4><Button type="button" size="sm" variant="outline" onClick={() => setScopeRows((prev) => [...prev, { pelajaran_id: "", program_id: "", kelas_id: "" }])}><Plus className="mr-1 h-4 w-4" /> Tambah Scope</Button></div>
                  {scopeRows.map((scope, index) => (
                    <div key={index} className="grid gap-3 rounded-input border border-card-border bg-card-bg p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                      <Select label="Program" value={scope.program_id} onChange={(e) => updateScopeRow(index, { program_id: e.target.value })} options={[{ value: "", label: "Semua program" }, ...programList.map((p) => ({ value: p.id, label: p.nama }))]} />
                      <Select label="Mata Pelajaran" required value={scope.pelajaran_id} onChange={(e) => updateScopeRow(index, { pelajaran_id: e.target.value })} options={[{ value: "", label: "Pilih pelajaran" }, ...pelajaranList.filter((p) => !scope.program_id || p.program_id == null || p.program_id === Number(scope.program_id)).map((p) => ({ value: p.id, label: p.nama }))]} />
                      <Select label="Kelas" value={scope.kelas_id} onChange={(e) => updateScopeRow(index, { kelas_id: e.target.value })} options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]} />
                      <Button type="button" size="sm" variant="danger" disabled={scopeRows.length === 1} onClick={() => setScopeRows((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Tambah User</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setError(""); }}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {resetTarget && (
        <Card
          title={`Reset Password: ${resetTarget.username}`}
          action={
            <Button variant="outline" size="sm" onClick={closeReset} disabled={resetting}>
              Tutup
            </Button>
          }
        >
          <form onSubmit={handleResetSubmit} className="space-y-4">
            {resetError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                {resetSuccess}
              </div>
            )}
            <p className="text-sm text-text-muted">
              Setel password baru untuk akun ini. Setelah di-reset, sampaikan password baru tersebut
              ke pengguna terkait.
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
              <Button type="submit" disabled={resetting || !resetPassword}>
                {resetting ? "Menyimpan..." : "Reset Password"}
              </Button>
              <Button type="button" variant="outline" onClick={closeReset} disabled={resetting}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {guruDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-heading-dark/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-modal border border-card-border bg-card-bg shadow-modal">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4"><div><h2 className="text-lg font-bold text-heading-dark">{editingGuru ? "Edit Profil Guru" : "Detail Guru"}</h2><p className="text-sm text-text-muted">{guruDetail.username}</p></div><button onClick={() => { setGuruDetail(null); setEditingGuru(false); }} className="rounded-lg px-2 py-1 text-xl text-text-muted hover:bg-neutral">×</button></div>
            <div className="space-y-5 p-5">
              {guruEditError && <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">{guruEditError}</div>}
              {editingGuru ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2"><Input label="Nama Lengkap" required value={editGuruForm.nama_lengkap} onChange={(e) => setEditGuruForm({ ...editGuruForm, nama_lengkap: e.target.value })} /><Input label="NIP / Identitas" value={editGuruForm.nip} onChange={(e) => setEditGuruForm({ ...editGuruForm, nip: e.target.value })} /><Input label="Email" type="email" value={editGuruForm.email} onChange={(e) => setEditGuruForm({ ...editGuruForm, email: e.target.value })} /><Input label="Nomor HP" value={editGuruForm.no_hp} onChange={(e) => setEditGuruForm({ ...editGuruForm, no_hp: e.target.value })} /></div>
                  <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-heading-dark">Penugasan</h3><Button type="button" size="sm" variant="outline" onClick={() => setEditScopeRows((prev) => [...prev, { pelajaran_id: "", program_id: "", kelas_id: "" }])}><Plus className="mr-1 h-4 w-4" /> Tambah</Button></div>{editScopeRows.map((scope, index) => <div key={index} className="grid gap-3 rounded-input border border-card-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><Select label="Program" value={scope.program_id} onChange={(e) => updateEditScopeRow(index, { program_id: e.target.value })} options={[{ value: "", label: "Semua program" }, ...programList.map((p) => ({ value: p.id, label: p.nama }))]} /><Select label="Mata Pelajaran" required value={scope.pelajaran_id} onChange={(e) => updateEditScopeRow(index, { pelajaran_id: e.target.value })} options={[{ value: "", label: "Pilih pelajaran" }, ...pelajaranList.filter((p) => !scope.program_id || p.program_id == null || p.program_id === Number(scope.program_id)).map((p) => ({ value: p.id, label: p.nama }))]} /><Select label="Kelas" value={scope.kelas_id} onChange={(e) => updateEditScopeRow(index, { kelas_id: e.target.value })} options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]} /><Button type="button" size="sm" variant="danger" disabled={editScopeRows.length === 1} onClick={() => setEditScopeRows((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
                </>
              ) : (
                <><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">Nama Lengkap</dt><dd className="font-semibold text-heading-dark">{guruDetail.nama_lengkap}</dd></div><div><dt className="text-text-muted">NIP / Identitas</dt><dd className="font-semibold text-heading-dark">{guruDetail.nip || "-"}</dd></div><div><dt className="text-text-muted">Email</dt><dd className="font-semibold text-heading-dark">{guruDetail.email || "-"}</dd></div><div><dt className="text-text-muted">Nomor HP</dt><dd className="font-semibold text-heading-dark">{guruDetail.no_hp || "-"}</dd></div></dl><div><h3 className="mb-2 text-sm font-bold text-heading-dark">Penugasan</h3><div className="space-y-2">{guruDetail.scopes.map((scope) => <div key={scope.id} className="rounded-input border border-card-border p-3"><p className="text-sm font-bold text-heading-dark">{scope.pelajaran_nama}</p><p className="text-xs text-text-muted">{scope.program_nama || "Semua program"} · {scope.kelas_nama || "Semua kelas"}</p></div>)}</div></div></>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-card-border px-5 py-4">{editingGuru ? <><Button variant="outline" disabled={savingGuru} onClick={() => setEditingGuru(false)}>Batal</Button><Button disabled={savingGuru} onClick={saveGuruProfile}>{savingGuru ? "Menyimpan..." : "Simpan Perubahan"}</Button></> : <><Button variant="outline" onClick={() => setGuruDetail(null)}>Tutup</Button><Button onClick={startEditGuru}>Edit Profil & Scope</Button></>}</div>
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter tipe user">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={roleFilter === option.value}
                onClick={() => setRoleFilter(option.value)}
                className={`rounded-btn border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                  roleFilter === option.value
                    ? "border-brand-primary bg-brand-primary text-heading-light"
                    : "border-card-border bg-card-bg text-body-dark hover:border-brand-primary/30 hover:bg-brand-primary/5"
                }`}
              >
                {option.label}
                <span className="ml-1.5 text-xs opacity-70">{option.jumlah}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari username / tipe user..."
              className="w-full rounded-input border border-card-border bg-card-bg py-2.5 pl-9 pr-3 text-sm text-body-dark placeholder:text-text-muted outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>
        </div>
        <p className="mb-3 text-xs text-text-muted">Menampilkan {filteredUsers.length} dari {users.length} user</p>
        <Table paginate newestFirst  data={filteredUsers} columns={columns} emptyMessage={searchQuery || roleFilter !== "semua" ? "Tidak ada user yang cocok dengan filter." : "Belum ada user"} />
      </Card>
      {dialog}
    </div>
  );
}
