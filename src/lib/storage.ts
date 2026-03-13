import type { AuthSession } from "../types";

const AUTH_STORAGE_KEY = "sermo.auth.session";

export const authStorage = {
  get(): AuthSession | null {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  },

  set(session: AuthSession | null) {
    if (!session) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  },
};
