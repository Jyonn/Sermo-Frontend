import type { AuthSession, SpaceAdminSession } from "../types";

const AUTH_STORAGE_KEY = "sermo.auth.session";
const ADMIN_AUTH_STORAGE_KEY = "sermo.admin.session";

export const authStorage = {
  get(): AuthSession | null {
    if (typeof window === "undefined") return null;
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
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  },
};

export const adminAuthStorage = {
  get(): SpaceAdminSession | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SpaceAdminSession;
    } catch {
      window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
      return null;
    }
  },

  set(session: SpaceAdminSession | null) {
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
  },
};
