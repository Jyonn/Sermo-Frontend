import currentRelease from "../../release-notes.json" with { type: "json" };

export interface ReleaseNotes {
  id: string;
  publishedAt: string;
  locales: Record<string, {
    title: string;
    items: string[];
  }>;
}

const UPDATE_SOURCES = [
  { key: "primary" as const, origin: "https://sermo.jyonn.space" },
  { key: "mirror" as const, origin: "https://sermo.6-79.cn" },
];

export type UpdateSourceKey = typeof UPDATE_SOURCES[number]["key"];

export interface UpdateSourceResult {
  key: UpdateSourceKey;
  origin: string;
  release: ReleaseNotes | null;
  releaseId: string | null;
  status: "ok" | "error";
}

export interface ExplicitUpdateCheckResult {
  currentRelease: ReleaseNotes;
  latestRelease: ReleaseNotes | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  sources: UpdateSourceResult[];
}

interface UpdateCheckSnapshot {
  checking: boolean;
  result: ExplicitUpdateCheckResult | null;
}

let updateCheckSnapshot: UpdateCheckSnapshot = { checking: false, result: null };
let updateCheckPromise: Promise<ExplicitUpdateCheckResult> | null = null;
const updateCheckListeners = new Set<() => void>();

export function getPwaUpdateCheckSnapshot() {
  return updateCheckSnapshot;
}

export function subscribePwaUpdateCheck(listener: () => void) {
  updateCheckListeners.add(listener);
  return () => { updateCheckListeners.delete(listener); };
}

function publishUpdateCheck(snapshot: UpdateCheckSnapshot) {
  updateCheckSnapshot = snapshot;
  updateCheckListeners.forEach((listener) => listener());
}

export const CURRENT_RELEASE = currentRelease as ReleaseNotes;

function compareReleaseIds(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function isReleaseNotes(value: unknown): value is ReleaseNotes {
  if (!value || typeof value !== "object") return false;
  const release = value as Partial<ReleaseNotes>;
  return typeof release.id === "string"
    && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.id)
    && typeof release.publishedAt === "string"
    && Boolean(release.locales && typeof release.locales === "object");
}

async function fetchReleaseFromSource(source: typeof UPDATE_SOURCES[number]): Promise<UpdateSourceResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${source.origin}/release.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release: unknown = await response.json();
    if (!isReleaseNotes(release)) throw new Error("Invalid release metadata");
    return { ...source, release, releaseId: release.id, status: "ok" };
  } catch {
    return { ...source, release: null, releaseId: null, status: "error" };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function checkForPwaUpdate(): Promise<ExplicitUpdateCheckResult> {
  if (updateCheckPromise) return updateCheckPromise;
  publishUpdateCheck({ ...updateCheckSnapshot, checking: true });
  updateCheckPromise = (async () => {
    const sources = await Promise.all(UPDATE_SOURCES.map(fetchReleaseFromSource));
    const latestVersion = sources.reduce<string | null>((latest, source) => {
      if (!source.releaseId) return latest;
      return !latest || compareReleaseIds(source.releaseId, latest) > 0 ? source.releaseId : latest;
    }, null);
    const latestRelease = sources.reduce<ReleaseNotes | null>((latest, source) => {
      if (!source.release) return latest;
      return !latest || compareReleaseIds(source.release.id, latest.id) > 0 ? source.release : latest;
    }, null);
    const result = {
      currentRelease: CURRENT_RELEASE,
      latestRelease,
      latestVersion,
      updateAvailable: Boolean(latestVersion && compareReleaseIds(latestVersion, CURRENT_RELEASE.id) > 0),
      sources,
    };
    publishUpdateCheck({ checking: false, result });
    return result;
  })().finally(() => {
    updateCheckPromise = null;
    if (updateCheckSnapshot.checking) publishUpdateCheck({ ...updateCheckSnapshot, checking: false });
  });
  return updateCheckPromise;
}

function waitForWaitingWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  const installing = registration.installing;
  if (!installing) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      installing.removeEventListener("statechange", onStateChange);
      resolve(registration.waiting);
    };
    const onStateChange = () => {
      if (installing.state === "installed" || installing.state === "redundant") finish();
    };
    const timeout = window.setTimeout(finish, 8000);
    installing.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

export type UpdateActivationPhase = "preparing" | "installing" | "restarting";

export async function activatePwaUpdate(onPhase?: (phase: UpdateActivationPhase) => void) {
  onPhase?.("preparing");
  const registration = "serviceWorker" in navigator
    ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
    : undefined;
  if (registration) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        registration.update().catch(() => undefined),
        new Promise<void>((resolve) => { timeout = globalThis.setTimeout(resolve, 8000); }),
      ]);
    } finally {
      if (timeout) globalThis.clearTimeout(timeout);
    }
  }
  onPhase?.("installing");
  const worker = registration ? await waitForWaitingWorker(registration) : null;
  if (!worker) {
    onPhase?.("restarting");
    window.sessionStorage.setItem("sermo:diagnostics:reload-reason", "user-requested-pwa-update");
    window.location.reload();
    return;
  }
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    onPhase?.("restarting");
    window.clearTimeout(fallback);
    navigator.serviceWorker.removeEventListener("controllerchange", reload);
    window.sessionStorage.setItem("sermo:diagnostics:reload-reason", "user-requested-pwa-update");
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", reload);
  const fallback = window.setTimeout(reload, 8000);
  try {
    worker.postMessage({ type: "SKIP_WAITING" });
  } catch {
    reload();
  }
}
