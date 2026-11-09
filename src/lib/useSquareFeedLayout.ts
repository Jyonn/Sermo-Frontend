import { useSyncExternalStore } from "react";
import type { SquareFeedLayout } from "./squareFeedLayout";

export type SquareLayoutChannel = "explore" | "friends" | "user";
const prefix = "frienden:square-layout:v2:";
const legacyPrefix = "frienden:square-layout:v1:";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function scopeKey(scope: string | null) {
  return prefix + (scope ?? "guest");
}

function preference(key: string, fallback: string, legacyKey?: string) {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  let value = fallback;
  try {
    value = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null) ?? fallback;
  } catch { /* Device storage is optional. */ }
  memory.set(key, value);
  return value;
}

function writePreference(key: string, value: string) {
  memory.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* Keep the in-memory preference. */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isSquareLayoutUnified(scope: string | null) {
  return preference(scopeKey(scope) + ":mode", "unified") !== "per-channel";
}

export function setSquareLayoutUnified(scope: string | null, unified: boolean) {
  writePreference(scopeKey(scope) + ":mode", unified ? "unified" : "per-channel");
}

export function getSquareChannelLayout(scope: string | null, channel: SquareLayoutChannel) {
  const legacyKey = channel === "explore" ? legacyPrefix + (scope ?? "guest") : undefined;
  return preference(scopeKey(scope) + ":" + channel, "list", legacyKey) === "masonry" ? "masonry" : "list";
}

export function setSquareFeedLayout(scope: string | null, next: SquareFeedLayout, channel: SquareLayoutChannel) {
  writePreference(scopeKey(scope) + ":" + channel, next);
}

export function getSquareFeedLayout(scope: string | null, channel: SquareLayoutChannel) {
  return isSquareLayoutUnified(scope) ? "list" : getSquareChannelLayout(scope, channel);
}

if (typeof window !== "undefined") window.addEventListener("storage", (event) => {
  if (event.key !== null && !event.key.startsWith(prefix) && !event.key.startsWith(legacyPrefix)) return;
  memory.clear();
  listeners.forEach((listener) => listener());
});

export function useSquareLayoutUnified(scope: string | null) {
  const value = useSyncExternalStore(subscribe, () => isSquareLayoutUnified(scope), () => true);
  return [value, (unified: boolean) => setSquareLayoutUnified(scope, unified)] as const;
}

export function useSquareChannelLayout(scope: string | null, channel: SquareLayoutChannel) {
  const value = useSyncExternalStore(subscribe, () => getSquareChannelLayout(scope, channel), () => "list" as const);
  return [value, (next: SquareFeedLayout) => setSquareFeedLayout(scope, next, channel)] as const;
}

export function useSquareFeedLayout(scope: string | null, channel: SquareLayoutChannel) {
  const value = useSyncExternalStore(subscribe, () => getSquareFeedLayout(scope, channel), () => "list" as const);
  return [value] as const;
}
