import axios, { AxiosError } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan."): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail || fallback;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "string" ? item : (item as { msg?: string })?.msg))
      .filter((msg): msg is string => !!msg);
    return messages.length > 0 ? messages.join(", ") : fallback;
  }
  if (detail && typeof detail === "object" && "msg" in detail) {
    return String((detail as { msg: string }).msg) || fallback;
  }
  return fallback;
}

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

// Refresh token dirotasi dan server mencabut SEMUA sesi bila token lama dipakai
// ulang (deteksi pencurian). Token disimpan di localStorage yang dipakai
// bersama semua tab, jadi dua tab yang me-refresh bersamaan dengan token yang
// sama akan saling me-logout (mis. tab dashboard + tab ujian). Karena itu
// refresh diserialkan antar-tab dengan Web Locks, dan tab yang terlambat
// memakai token yang sudah diperbarui tab lain alih-alih me-refresh lagi.
async function refreshAccessToken(failedAccessToken: string | null): Promise<string> {
  const run = async () => {
    const current = getAccessToken();
    if (current && current !== failedAccessToken) {
      return current;
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error("Tidak ada refresh token");
    }
    const response = await api.post("/auth/refresh-token", {
      refresh_token: refreshToken
    });
    const accessToken = response.data.access_token as string;
    const nextRefreshToken = (response.data.refresh_token as string | undefined) || refreshToken;
    setTokens(accessToken, nextRefreshToken);
    return accessToken;
  };
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("cbt-refresh-token", run);
  }
  return run();
}

function bearerToken(headers: unknown): string | null {
  const raw = (headers as { Authorization?: unknown } | undefined)?.Authorization;
  return typeof raw === "string" && raw.startsWith("Bearer ") ? raw.slice(7) : null;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (!current.startsWith("/login")) {
    window.location.href = `/login?redirect=${encodeURIComponent(current)}`;
  } else {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const url = original?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/logout") || url.includes("/auth/refresh-token");

    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshing) {
        refreshing = refreshAccessToken(bearerToken(original.headers)).finally(() => {
          refreshing = null;
        });
      }
      await refreshing;
      return api(original);
    } catch (refreshError) {
      clearTokens();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);
