import type { AuthSession } from "../types";

const STORAGE_PREFIX = "sermo:gesture-lock:v1";
const UNLOCK_PREFIX = "sermo:gesture-unlocked:v1";
const ACTIVITY_PREFIX = "sermo:gesture-activity:v1";
export const DEFAULT_GESTURE_LOCK_AFTER_MINUTES = 1;
export const MAX_GESTURE_LOCK_AFTER_MINUTES = 30;

export interface GestureLockConfig {
  enabled: boolean;
  hash: string;
  salt: string;
  lock_after_minutes?: number;
  updated_at: number;
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function unlockKey(scope: string) {
  return `${UNLOCK_PREFIX}:${scope}`;
}

function activityKey(scope: string) {
  return `${ACTIVITY_PREFIX}:${scope}`;
}

function normalizeLockAfterMinutes(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GESTURE_LOCK_AFTER_MINUTES;
  return Math.min(MAX_GESTURE_LOCK_AFTER_MINUTES, Math.max(1, Math.round(numeric)));
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
    return {
      ...parsed,
      lock_after_minutes: normalizeLockAfterMinutes(parsed.lock_after_minutes),
    };
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
  markGestureActivity(scope);
}

export function clearGestureUnlock(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.removeItem(unlockKey(scope));
  window.sessionStorage.removeItem(activityKey(scope));
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

export function markGestureActivity(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.setItem(activityKey(scope), String(Date.now()));
}

export function getGestureLastActivity(scope: string | null) {
  if (!scope || typeof window === "undefined") return 0;
  return Number(window.sessionStorage.getItem(activityKey(scope)) || 0);
}

export function getGestureLockAfterMinutes(scope: string | null) {
  return normalizeLockAfterMinutes(getGestureLockConfig(scope)?.lock_after_minutes);
}

export function getGestureLockAfterMs(scope: string | null) {
  return getGestureLockAfterMinutes(scope) * 60 * 1000;
}

export function setGestureLockAfterMinutes(scope: string | null, minutes: number) {
  if (!scope || typeof window === "undefined") return null;
  const config = getGestureLockConfig(scope);
  if (!config) return null;
  const next = {
    ...config,
    lock_after_minutes: normalizeLockAfterMinutes(minutes),
    updated_at: Date.now(),
  };
  window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
  return next;
}

export async function saveGesturePattern(scope: string, pattern: string, lockAfterMinutes = DEFAULT_GESTURE_LOCK_AFTER_MINUTES) {
  const salt = createGestureSalt();
  const hash = await hashGesturePattern(pattern, salt);
  const config: GestureLockConfig = {
    enabled: true,
    hash,
    salt,
    lock_after_minutes: normalizeLockAfterMinutes(lockAfterMinutes),
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
