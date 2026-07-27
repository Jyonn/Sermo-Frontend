import type { AuthSession } from "../types";
import type { GestureLockPreferenceDTO } from "../types";

const UNLOCK_PREFIX = "sermo:gesture-unlocked:v1";
const LOCKED_PREFIX = "sermo:gesture-locked:v1";
const DECOY_PREFIX = "sermo:gesture-decoy:v1";
const ACTIVITY_PREFIX = "sermo:gesture-activity:v1";
const PREFERENCE_UPDATED_EVENT = "sermo:gesture-lock-preference-updated";
export const DEFAULT_GESTURE_LOCK_AFTER_MINUTES = 1;
export const MAX_GESTURE_LOCK_AFTER_MINUTES = 30;

function unlockKey(scope: string) {
  return `${UNLOCK_PREFIX}:${scope}`;
}

function lockedKey(scope: string) {
  return `${LOCKED_PREFIX}:${scope}`;
}

function decoyKey(scope: string) {
  return `${DECOY_PREFIX}:${scope}`;
}

function activityKey(scope: string) {
  return `${ACTIVITY_PREFIX}:${scope}`;
}

export function normalizeGestureLockAfterMinutes(value: unknown) {
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

export function isGestureLockPreferenceEnabled(preference: GestureLockPreferenceDTO | null | undefined) {
  return Boolean(preference?.enabled && preference.pattern_hash && preference.salt);
}

export function isGestureUnlocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(unlockKey(scope)) === "1";
}

export function isGestureLocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(lockedKey(scope)) === "1";
}

export function isGestureAccessSuppressed(scope: string | null) {
  return isGestureLocked(scope);
}

export function markGestureLocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.setItem(lockedKey(scope), "1");
}

export function markGestureUnlocked(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.removeItem(lockedKey(scope));
  window.sessionStorage.removeItem(decoyKey(scope));
  window.sessionStorage.setItem(unlockKey(scope), "1");
  markGestureActivity(scope);
}

export function clearGestureUnlock(scope: string | null) {
  if (!scope || typeof window === "undefined") return;
  window.sessionStorage.removeItem(unlockKey(scope));
  window.sessionStorage.removeItem(lockedKey(scope));
  window.sessionStorage.removeItem(decoyKey(scope));
  window.sessionStorage.removeItem(activityKey(scope));
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

export function getGestureLockAfterMinutes(preference: GestureLockPreferenceDTO | null | undefined) {
  return normalizeGestureLockAfterMinutes(preference?.lock_after_minutes);
}

export function getGestureLockAfterMs(preference: GestureLockPreferenceDTO | null | undefined) {
  return getGestureLockAfterMinutes(preference) * 60 * 1000;
}

export async function buildGestureLockPayload(pattern: string, lockAfterMinutes = DEFAULT_GESTURE_LOCK_AFTER_MINUTES) {
  const salt = createGestureSalt();
  const pattern_hash = await hashGesturePattern(pattern, salt);
  return {
    enabled: 1 as const,
    pattern_hash,
    salt,
    lock_after_minutes: normalizeGestureLockAfterMinutes(lockAfterMinutes),
  };
}

export async function verifyGesturePattern(preference: GestureLockPreferenceDTO | null | undefined, pattern: string) {
  if (!isGestureLockPreferenceEnabled(preference)) return true;
  const enabledPreference = preference as GestureLockPreferenceDTO;
  const hash = await hashGesturePattern(pattern, enabledPreference.salt);
  return hash === enabledPreference.pattern_hash;
}

export function emitGestureLockPreferenceUpdated(preference?: GestureLockPreferenceDTO) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GestureLockPreferenceDTO | undefined>(PREFERENCE_UPDATED_EVENT, { detail: preference }));
}

export function listenGestureLockPreferenceUpdated(listener: (preference?: GestureLockPreferenceDTO) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<GestureLockPreferenceDTO | undefined>).detail);
  window.addEventListener(PREFERENCE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(PREFERENCE_UPDATED_EVENT, handler);
}
