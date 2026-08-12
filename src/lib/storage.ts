import type { AuthSession, PlatformAdminSession, SpaceAdminSession } from "../types";
import { getDetectedSpaceSlug } from "./spaceEntry";

const AUTH_STORAGE_KEY = "sermo.auth.session";
const ADMIN_AUTH_STORAGE_KEY = "sermo.admin.session";
const PLATFORM_ADMIN_AUTH_STORAGE_KEY = "sermo.platform-admin.session";

function scopedKey(baseKey: string) {
  const slug = getDetectedSpaceSlug();
  return slug ? `${baseKey}:${slug}` : baseKey;
}

export const authStorage = {
  get(): AuthSession | null {
    if (typeof window === "undefined") return null;
    const key = scopedKey(AUTH_STORAGE_KEY);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      window.localStorage.removeItem(key);
      return null;
    }
  },

  set(session: AuthSession | null) {
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(scopedKey(AUTH_STORAGE_KEY));
      return;
    }
    window.localStorage.setItem(scopedKey(AUTH_STORAGE_KEY), JSON.stringify(session));
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

export const platformAdminAuthStorage = {
  get(): PlatformAdminSession | null {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(PLATFORM_ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlatformAdminSession;
    } catch {
      window.sessionStorage.removeItem(PLATFORM_ADMIN_AUTH_STORAGE_KEY);
      return null;
    }
  },
  set(session: PlatformAdminSession | null) {
    if (typeof window === "undefined") return;
    if (!session) window.sessionStorage.removeItem(PLATFORM_ADMIN_AUTH_STORAGE_KEY);
    else window.sessionStorage.setItem(PLATFORM_ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
  },
};
