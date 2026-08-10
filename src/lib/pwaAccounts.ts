import type { AuthSession } from "../types";
import { listRecentSpaces } from "./recentSpaces";

const AUTH_STORAGE_PREFIX = "sermo.auth.session:";
const PWA_DEFAULT_ACCOUNT_KEY = "sermo:pwa:default-account:v1";
const PWA_AUTO_LOGIN_KEY = "sermo:pwa:auto-login:v1";

export interface PwaCachedAccount {
  key: string;
  slug: string;
  spaceName: string;
  session: AuthSession;
  lastVisitedAt: number;
}

export function listPwaCachedAccounts(): PwaCachedAccount[] {
  if (typeof window === "undefined") return [];
  const spaces = new Map(listRecentSpaces().map((space) => [space.slug, space]));
  const accounts: PwaCachedAccount[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey?.startsWith(AUTH_STORAGE_PREFIX)) continue;
    const slug = storageKey.slice(AUTH_STORAGE_PREFIX.length).trim().toLowerCase();
    if (!slug) continue;
    try {
      const session = JSON.parse(window.localStorage.getItem(storageKey) || "null") as AuthSession | null;
      if (!session?.refreshToken || !session.user?.user_id) continue;
      const recent = spaces.get(slug);
      accounts.push({
        key: `${slug}:${session.user.user_id}`,
        slug,
        spaceName: recent?.name || slug,
        session,
        lastVisitedAt: recent?.lastVisitedAt || 0,
      });
    } catch {
      // Ignore malformed legacy sessions; the regular login flow can replace them.
    }
  }
  return accounts.sort((left, right) => right.lastVisitedAt - left.lastVisitedAt);
}

export function getDefaultPwaAccountKey() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(PWA_DEFAULT_ACCOUNT_KEY) || "";
}

export function setDefaultPwaAccountKey(key: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(PWA_DEFAULT_ACCOUNT_KEY, key);
}

export function isPwaAutoLoginEnabled() {
  return typeof window !== "undefined" && window.localStorage.getItem(PWA_AUTO_LOGIN_KEY) === "1";
}

export function setPwaAutoLoginEnabled(enabled: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(PWA_AUTO_LOGIN_KEY, enabled ? "1" : "0");
}
