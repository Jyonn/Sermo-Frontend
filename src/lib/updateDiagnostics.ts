const KEY = "sermo:update-attempt";
type Entry = { at: number; elapsed: number; event: "update"; metrics: Record<string, string | number | boolean | null> };
type Attempt = { target: string; pending: boolean; failed: boolean; entries: Entry[] };
let attempt: Attempt | null = null;
try {
  const stored = JSON.parse(sessionStorage.getItem(KEY) || "null");
  if (stored && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(stored.target) && Array.isArray(stored.entries) && stored.entries.length <= 100) attempt = stored;
} catch { /* Storage may be unavailable. */ }
function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify(attempt)); } catch { /* Keep the in-memory report. */ }
}
export function beginUpdate(target: string) {
  attempt = { target, pending: false, failed: false, entries: [] };
  recordUpdate(1, { targetVersion: target });
}
export function recordUpdate(stage: number, metrics: Entry["metrics"] = {}) {
  if (!attempt) return;
  const at = Date.now();
  attempt.entries.push({ at, elapsed: at - (attempt.entries[0]?.at ?? at), event: "update", metrics: { stage, ...metrics } });
  attempt.entries = attempt.entries.slice(-100);
  persist();
}
export function markUpdateReload() { if (attempt) { attempt.pending = true; persist(); } }
export function failUpdate() { if (attempt) { attempt.failed = true; attempt.pending = false; recordUpdate(9); } }
export function reconcileUpdate(version: string) {
  if (!attempt?.pending) return;
  attempt.pending = false;
  attempt.failed = compareVersions(version, attempt.target) < 0;
  recordUpdate(attempt.failed ? 9 : 8, { runningVersion: version });
}
export function compareVersions(left: string, right: string) {
  const a = left.split(".").map(Number), b = right.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference;
  }
  return 0;
}
export function hasUpdateFailure() { return Boolean(attempt?.failed); }
export function getUpdateReport() { return { generatedAt: new Date().toISOString(), entries: attempt?.entries ?? [] }; }
