import type { AuthSession } from "../types";

const STORAGE_PREFIX = "sermo:gesture-lock:v1";
const UNLOCK_PREFIX = "sermo:gesture-unlocked:v1";

export interface GestureLockConfig {
  enabled: boolean;
  hash: string;
  salt: string;
  updated_at: number;
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function unlockKey(scope: string) {
  return `${UNLOCK_PREFIX}:${scope}`;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function fallbackHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

export function getGestureLockScope(session: AuthSession | null) {
  const spaceId = session?.user.space_id;
  const userId = session?.user.user_id;
  if (!spaceId || !userId) return null;
  return `${spaceId}:${userId}`;
}

export function getGestureLockConfig(scope: string | null): GestureLockConfig | null {
  if (!scope || typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(scope));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GestureLockConfig;
    if (!parsed.enabled || !parsed.hash || !parsed.salt) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey(scope));
    return null;
  }
}

export function isGestureLockEnabled(scope: string | null) {
  return Boolean(getGestureLockConfig(scope));
}

export function isGestureUnlocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(unlockKey(scope)) === "1";
}

export function markGestureUnlocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.setItem(unlockKey(scope), "1");
}

export function clearGestureUnlock(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.removeItem(unlockKey(scope));
}

export function clearGestureLock(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(scope));
  clearGestureUnlock(scope);
}

export function createGestureSalt() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export async function hashGesturePattern(pattern: string, salt: string) {
  const value = `${salt}:${pattern}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(value);
    return toHex(await crypto.subtle.digest("SHA-256", encoded));
  }
  return fallbackHash(value);
}

export async function saveGesturePattern(scope: string, pattern: string) {
  const salt = createGestureSalt();
  const hash = await hashGesturePattern(pattern, salt);
  const config: GestureLockConfig = {
    enabled: true,
    hash,
    salt,
    updated_at: Date.now(),
  };
  window.localStorage.setItem(storageKey(scope), JSON.stringify(config));
  markGestureUnlocked(scope);
  return config;
}

export async function verifyGesturePattern(scope: string, pattern: string) {
  const config = getGestureLockConfig(scope);
  if (!config) return true;
  const hash = await hashGesturePattern(pattern, config.salt);
  return hash === config.hash;
}

