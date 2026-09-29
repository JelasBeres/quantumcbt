"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { login } from "@/lib/auth";
import Button from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(formData.username, formData.password);

      // Redirect based on role
      if (user.role === "siswa") {
        router.push("/siswa/dashboard");
      } else if (user.role === "guru") {
        router.push("/guru/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login gagal. Periksa username dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-4">
      {/* Dekorasi latar */}
      <div className="pointer-events-none absolute inset-0 hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cta/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle at 25% 20%, #2D3C8F 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Brand */}
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-card bg-white shadow-card ring-1 ring-card-border">
            <Image
              src="/quantum-research-logo.png"
              alt="Logo Quantum Research"
              width={64}
              height={64}
              className="h-14 w-14 object-contain"
              priority
            />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-heading-dark">Quantum Research</h1>
          <p className="mt-1 text-sm text-text-muted">Computer Based Test System</p>
        </div>

        <div className="overflow-hidden rounded-modal border border-card-border bg-white shadow-card">
          {/* Header brand */}
          <div className="bg-brand-primary-dark px-6 py-4">
            <h2 className="text-lg font-bold text-white">Login</h2>
            <p className="mt-0.5 text-sm text-body-light">Masuk ke akun Anda</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
            {error && (
              <div className="rounded-input border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-body-dark">
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Masukkan username"
                  disabled={loading}
                  className="w-full rounded-input border border-card-border bg-white py-2.5 pl-10 pr-3 text-sm text-body-dark placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-body-dark">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Masukkan password"
                  disabled={loading}
                  className="w-full rounded-input border border-card-border bg-white py-2.5 pl-10 pr-11 text-sm text-body-dark placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-input text-text-muted transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full text-sm font-bold shadow-lg shadow-cta/20" size="lg" disabled={loading}>
              {loading ? "Memproses..." : "Login"}
            </Button>

            <div className="text-center text-sm text-text-muted">
              <p>Belum punya akun? Hubungi administrator</p>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-text-muted">
          <p>CBT Quantum Research v1.0.0</p>
          <p className="mt-1">© 2026 Quantum Research. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
