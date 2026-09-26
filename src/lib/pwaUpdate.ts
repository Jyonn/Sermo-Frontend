import currentRelease from "../../release-notes.json";

export const PWA_UPDATE_AVAILABLE_EVENT = "sermo:pwa-update-available";

export interface ReleaseNotes {
  id: string;
  publishedAt: string;
  locales: Record<string, {
    title: string;
    items: string[];
  }>;
}

export interface PwaUpdateAnnouncement {
  release: ReleaseNotes | null;
  updateAvailable: boolean;
}

let waitingWorker: ServiceWorker | null = null;
let releaseScriptQueue: Promise<void> = Promise.resolve();

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
    const releaseId = await loadReleaseIdScript(source.origin);
    return { ...source, release: null, releaseId, status: releaseId ? "ok" : "error" };
  } finally {
    window.clearTimeout(timeout);
  }
}

function loadReleaseIdScript(origin: string) {
  const task = releaseScriptQueue.then(() => loadReleaseIdScriptUnqueued(origin));
  releaseScriptQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function loadReleaseIdScriptUnqueued(origin: string) {
  const releaseWindow = window as Window & { SERMO_RELEASE_ID?: unknown };
  const previousValue = releaseWindow.SERMO_RELEASE_ID;
  delete releaseWindow.SERMO_RELEASE_ID;
  return new Promise<string | null>((resolve) => {
    const script = document.createElement("script");
    const finish = (value: string | null) => {
      window.clearTimeout(timeout);
      script.remove();
      if (previousValue === undefined) delete releaseWindow.SERMO_RELEASE_ID;
      else releaseWindow.SERMO_RELEASE_ID = previousValue;
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(null), 8000);
    script.async = true;
    script.src = `${origin}/sw-release.js?t=${Date.now()}`;
    script.onload = () => {
      const value = releaseWindow.SERMO_RELEASE_ID;
      finish(typeof value === "string" && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(value) ? value : null);
    };
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
}

export async function checkForPwaUpdate(): Promise<ExplicitUpdateCheckResult> {
  const registration = "serviceWorker" in navigator
    ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
    : undefined;
  await registration?.update().catch(() => undefined);
  if (registration?.waiting) waitingWorker = registration.waiting;

  const sources = await Promise.all(UPDATE_SOURCES.map(fetchReleaseFromSource));
  const latestVersion = sources.reduce<string | null>((latest, source) => {
    if (!source.releaseId) return latest;
    return !latest || compareReleaseIds(source.releaseId, latest) > 0 ? source.releaseId : latest;
  }, null);
  const latestRelease = sources.reduce<ReleaseNotes | null>((latest, source) => {
    if (!source.release) return latest;
    return !latest || compareReleaseIds(source.release.id, latest.id) > 0 ? source.release : latest;
  }, null);
  return {
    currentRelease: CURRENT_RELEASE,
    latestRelease,
    latestVersion,
    updateAvailable: Boolean(latestVersion && compareReleaseIds(latestVersion, CURRENT_RELEASE.id) > 0),
    sources,
  };
}

async function getReleaseNotes() {
  try {
    const response = await fetch(`/release.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as ReleaseNotes;
  } catch {
    return null;
  }
}

async function announceUpdate(worker: ServiceWorker) {
  const release = await getReleaseNotes();
  const updateAvailable = Boolean(release?.id && compareReleaseIds(release.id, currentRelease.id) > 0);
  console.info("[sermo:pwa-update] announcement", {
    currentReleaseId: currentRelease.id,
    fetchedReleaseId: release?.id ?? "unavailable",
    updateAvailable,
    workerState: worker.state,
    workerScript: worker.scriptURL,
  });
  waitingWorker = updateAvailable ? worker : null;
  window.dispatchEvent(new CustomEvent<PwaUpdateAnnouncement>(PWA_UPDATE_AVAILABLE_EVENT, {
    detail: { release, updateAvailable },
  }));
}

export function watchPwaUpdates(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    console.info("[sermo:pwa-update] waiting-worker-found", {
      workerScript: registration.waiting.scriptURL,
    });
    void announceUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    console.info("[sermo:pwa-update] update-found", {
      workerScript: worker.scriptURL,
      workerState: worker.state,
    });

    worker.addEventListener("statechange", () => {
      console.info("[sermo:pwa-update] worker-statechange", {
        workerScript: worker.scriptURL,
        workerState: worker.state,
        hasController: Boolean(navigator.serviceWorker.controller),
      });
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        void announceUpdate(worker);
      }
    });
  });
}

export function activatePwaUpdate() {
  const worker = waitingWorker;
  if (!worker) return false;
  console.info("[sermo:pwa-update] activation-requested", {
    workerScript: worker.scriptURL,
    workerState: worker.state,
  });
  worker.postMessage({ type: "SKIP_WAITING" });
  return true;
}
