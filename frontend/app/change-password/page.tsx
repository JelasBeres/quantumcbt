"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/lib/api";
import { getUser, clearTokens } from "@/lib/auth";
import Link from "next/link";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Card from "@/components/Card";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!getUser()) {
      router.push("/login");
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password minimal 8 karakter dengan huruf besar, huruf kecil, dan angka.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword
      });
      clearTokens();
      setSuccess("Password berhasil diubah. Silakan masuk kembali dengan password baru.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(getErrorMessage(err, "Gagal mengubah password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-6 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-heading-dark">Ganti Password</h1>
          <p className="mt-2 text-sm text-text-muted">Ubah kata sandi akun Anda.</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-input bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-input bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                {success} <Link href="/login" className="font-semibold underline">Masuk kembali</Link>
              </div>
            )}

            <Input
              label="Password Saat Ini"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password lama"
              disabled={loading || !!success}
            />
            <Input
              label="Password Baru"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              helper="Gunakan huruf besar, huruf kecil, dan angka."
              disabled={loading || !!success}
            />
            <Input
              label="Konfirmasi Password Baru"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              disabled={loading || !!success}
            />

            <Button type="submit" className="w-full" disabled={loading || !!success}>
              {loading ? "Menyimpan..." : "Ganti Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
