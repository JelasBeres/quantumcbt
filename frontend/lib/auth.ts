import { api } from "./api";

const ACCESS_TOKEN_KEY = "cbt_access_token";
const REFRESH_TOKEN_KEY = "cbt_refresh_token";
const USER_KEY = "cbt_user";

export type User = {
  id: number;
  username: string;
  role: "admin" | "guru" | "siswa";
  is_active: boolean;
};

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const userStr = window.localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken?: string | null) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setUser(user: User) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function login(username: string, password: string) {
  const response = await api.post("/auth/login", { username, password });
  const { access_token, refresh_token } = response.data;
  setTokens(access_token, refresh_token);

  // Get user info
  const userResponse = await api.get("/auth/me");
  setUser(userResponse.data);

  return userResponse.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout", { refresh_token: getRefreshToken() });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearTokens();
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function isRole(role: string): boolean {
  const user = getUser();
  return user?.role === role;
}
