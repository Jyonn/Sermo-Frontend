import type { AuthSession } from "../types";
import { ApiError, refreshDetachedAuthSession } from "./api";
import { listRecentSpaces } from "./recentSpaces";

const AUTH_STORAGE_PREFIX = "sermo.auth.session:";
const PWA_DEFAULT_ACCOUNT_KEY = "sermo:pwa:default-account:v1";
const PWA_AUTO_LOGIN_KEY = "sermo:pwa:auto-login:v1";
const PWA_ACCOUNT_VAULT_KEY = "sermo:pwa:accounts:v1";

export interface PwaCachedAccount {
  key: string;
  slug: string;
  spaceName: string;
  session: AuthSession;
  lastVisitedAt: number;
}

type StoredPwaAccount = Pick<PwaCachedAccount, "key" | "slug" | "session" | "lastVisitedAt">;

function readAccountVault(): StoredPwaAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PWA_ACCOUNT_VAULT_KEY) || "[]") as StoredPwaAccount[];
    return Array.isArray(value) ? value.filter((item) => item?.slug && item?.session?.refreshToken) : [];
  } catch {
    window.localStorage.removeItem(PWA_ACCOUNT_VAULT_KEY);
    return [];
  }
}

function writeAccountVault(accounts: StoredPwaAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PWA_ACCOUNT_VAULT_KEY, JSON.stringify(accounts.slice(0, 16)));
  } catch {
    // Scoped auth storage remains the source of truth if persistent storage is full.
  }
}

export function rememberPwaAccountSession(session: AuthSession, slug: string) {
  if (typeof window === "undefined" || !slug || !session.refreshToken || !session.user?.user_id) return;
  const key = `${slug}:${session.user.user_id}`;
  writeAccountVault([
    { key, slug, session, lastVisitedAt: Date.now() },
    ...readAccountVault().filter((account) => account.key !== key),
  ]);
}

export function forgetPwaAccountSession(session: AuthSession | null, slug: string) {
  if (!session || !slug) return;
  const key = `${slug}:${session.user.user_id}`;
  writeAccountVault(readAccountVault().filter((account) => account.key !== key));
  if (getDefaultPwaAccountKey() === key) window.localStorage.removeItem(PWA_DEFAULT_ACCOUNT_KEY);
}

export function listPwaCachedAccounts(): PwaCachedAccount[] {
  if (typeof window === "undefined") return [];
  const spaces = new Map(listRecentSpaces().map((space) => [space.slug, space]));
  const accountMap = new Map<string, StoredPwaAccount>();
  const mergeAccount = (account: StoredPwaAccount) => {
    const slug = account.slug.trim().toLowerCase();
    const userId = account.session?.user?.user_id;
    if (!slug || !userId) return;
    const key = `${slug}:${userId}`;
    const normalized = { ...account, key, slug };
    const existing = accountMap.get(key);
    if (!existing || normalized.lastVisitedAt >= existing.lastVisitedAt) accountMap.set(key, normalized);
  };
  readAccountVault().forEach(mergeAccount);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey?.startsWith(AUTH_STORAGE_PREFIX)) continue;
    const slug = storageKey.slice(AUTH_STORAGE_PREFIX.length).trim().toLowerCase();
    if (!slug) continue;
    try {
      const session = JSON.parse(window.localStorage.getItem(storageKey) || "null") as AuthSession | null;
      if (!session?.refreshToken || !session.user?.user_id) continue;
      const recent = spaces.get(slug);
      const key = `${slug}:${session.user.user_id}`;
      mergeAccount({
        key,
        slug,
        session,
        lastVisitedAt: Math.max(recent?.lastVisitedAt || 0, accountMap.get(key)?.lastVisitedAt || 0),
      });
    } catch {
      // Ignore malformed cached sessions; the regular login flow can replace them.
    }
  }
  return Array.from(accountMap.values()).map((account) => ({
    ...account,
    spaceName: spaces.get(account.slug)?.name || account.slug,
  })).sort((left, right) => right.lastVisitedAt - left.lastVisitedAt);
}

export async function refreshPwaCachedAccounts(signal?: AbortSignal): Promise<PwaCachedAccount[]> {
  const currentAccounts = listPwaCachedAccounts();
  const refreshed = await Promise.all(currentAccounts.map(async (account) => {
    try {
      const session = await refreshDetachedAuthSession(account.session, signal);
      return { ...account, key: `${account.slug}:${session.user.user_id}`, session };
    } catch (error) {
      if (signal?.aborted) throw error;
      return error instanceof ApiError && error.status === 401 ? null : account;
    }
  }));

  const accountMap = new Map<string, PwaCachedAccount>();
  refreshed.forEach((account) => {
    if (!account) return;
    const existing = accountMap.get(account.key);
    if (!existing || account.lastVisitedAt >= existing.lastVisitedAt) accountMap.set(account.key, account);
  });
  const accounts = Array.from(accountMap.values());
  writeAccountVault(accounts.map(({ key, slug, session, lastVisitedAt }) => ({ key, slug, session, lastVisitedAt })));

  for (const account of accounts) {
    const storageKey = `${AUTH_STORAGE_PREFIX}${account.slug}`;
    try {
      const scopedSession = JSON.parse(window.localStorage.getItem(storageKey) || "null") as AuthSession | null;
      if (scopedSession?.user.user_id === account.session.user.user_id) {
        window.localStorage.setItem(storageKey, JSON.stringify(account.session));
      }
    } catch {
      // The refreshed account vault is still valid if an old scoped session is malformed.
    }
  }

  return listPwaCachedAccounts();
}

export function activatePwaCachedAccount(account: PwaCachedAccount) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${AUTH_STORAGE_PREFIX}${account.slug}`, JSON.stringify(account.session));
  rememberPwaAccountSession(account.session, account.slug);
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
