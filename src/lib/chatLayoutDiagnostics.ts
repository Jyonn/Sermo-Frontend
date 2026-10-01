const STORAGE_KEY = "sermo:chat-layout-diagnostics-until";
const EVENT = "sermo:chat-layout-diagnostics-change";
const MAX_ENTRIES = 180;
const ENABLE_DURATION_MS = 24 * 60 * 60 * 1000;

export type ChatLayoutMetric = number | boolean | null;
export interface ChatLayoutEntry {
  at: number;
  elapsed: number;
  event: "viewport" | "layout" | "keyboard" | "windowScroll" | "scrollCorrection";
  metrics: Record<string, ChatLayoutMetric>;
}

interface ChatLayoutDiagnosticsState {
  enabled: boolean;
  entries: ChatLayoutEntry[];
}

function readExpiry() {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

let enabledUntil = readExpiry();
let state: ChatLayoutDiagnosticsState = { enabled: enabledUntil > Date.now(), entries: [] };
let publishTimer: number | null = null;
let expiryTimer: number | null = null;

function publish() {
  window.dispatchEvent(new Event(EVENT));
}

function schedulePublish() {
  if (publishTimer !== null) return;
  publishTimer = window.setTimeout(() => {
    publishTimer = null;
    publish();
  }, 120);
}

function scheduleExpiry() {
  if (expiryTimer !== null) window.clearTimeout(expiryTimer);
  if (enabledUntil <= Date.now()) return;
  expiryTimer = window.setTimeout(() => setChatLayoutDiagnosticsEnabled(false), enabledUntil - Date.now());
}

if (typeof window !== "undefined") scheduleExpiry();

export function getChatLayoutDiagnostics() {
  return state;
}

export function subscribeChatLayoutDiagnostics(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function setChatLayoutDiagnosticsEnabled(enabled: boolean) {
  enabledUntil = enabled ? Date.now() + ENABLE_DURATION_MS : 0;
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, String(enabledUntil));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Diagnostics remain available in memory when storage is unavailable.
  }
  state = { ...state, enabled };
  scheduleExpiry();
  publish();
}

export function clearChatLayoutDiagnostics() {
  state = { ...state, entries: [] };
  publish();
}

export function recordChatLayout(event: ChatLayoutEntry["event"], metrics: Record<string, ChatLayoutMetric>) {
  if (!state.enabled) return;
  if (enabledUntil <= Date.now()) {
    setChatLayoutDiagnosticsEnabled(false);
    return;
  }
  const safeMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)),
  );
  const entry: ChatLayoutEntry = { at: Date.now(), elapsed: Math.round(performance.now()), event, metrics: safeMetrics };
  state = { ...state, entries: [...state.entries, entry].slice(-MAX_ENTRIES) };
  schedulePublish();
}

export function chatLayoutDiagnosticsReport() {
  return JSON.stringify({ generatedAt: new Date().toISOString(), entries: state.entries }, null, 2);
}
