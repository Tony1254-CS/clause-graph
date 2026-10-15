import type { AuthUser } from "./auth.server";
import {
  signInWithPasswordFn,
  signUpWithPasswordFn,
  demoLoginFn,
  getCurrentUserFn,
} from "./auth.functions";

const TOKEN_KEY = "clausegraph_token";
const USER_KEY = "clausegraph_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Set cookie for SSR/server functions fallback
  document.cookie = `clausegraph_token=${token}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "clausegraph_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export async function signInWithPassword(email: string, password: string) {
  const result = await signInWithPasswordFn({ data: { email, password } });
  saveSession(result.token, result.user);
  return result;
}

export async function signUpWithPassword(email: string, password: string, fullName?: string) {
  const result = await signUpWithPasswordFn({ data: { email, password, fullName } });
  saveSession(result.token, result.user);
  return result;
}

export async function signInDemo() {
  const result = await demoLoginFn();
  saveSession(result.token, result.user);
  return result;
}

export async function signOut() {
  clearSession();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const user = await getCurrentUserFn();
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    clearSession();
    return null;
  }
}
