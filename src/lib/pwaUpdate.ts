import currentRelease from "../../release-notes.json" with { type: "json" };
import { beginUpdate, recordUpdate, failUpdate, markUpdateReload, reconcileUpdate, compareVersions } from "./updateDiagnostics.ts";
import { SITE_ORIGINS } from "./siteOrigins.ts";

export interface ReleaseNotes {
  id: string;
  publishedAt: string;
  locales: Record<string, {
    title: string;
    items: string[];
  }>;
}

export const UPDATE_SOURCES = SITE_ORIGINS;

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
reconcileUpdate(CURRENT_RELEASE.id);

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

async function fetchReleaseFromSource(source: { key: UpdateSourceKey; origin: string }): Promise<UpdateSourceResult> {
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

let activation: Promise<void> | null = null;
export function activatePwaUpdate(onPhase?: (phase: UpdateActivationPhase) => void) {
  if (activation) return activation;
  activation = runUpdate(onPhase).finally(() => { activation = null; });
  return activation;
}

async function runUpdate(onPhase?: (phase: UpdateActivationPhase) => void) {
  onPhase?.("preparing");
  const source = { key: "primary" as const, origin: window.location.origin };
  const local = await fetchReleaseFromSource(source);
  beginUpdate(local.releaseId ?? CURRENT_RELEASE.id);
  recordUpdate(2, { runningVersion: CURRENT_RELEASE.id, site: UPDATE_SOURCES.findIndex((site) => site.origin === window.location.origin) + 1, online: navigator.onLine });
  try {
    if (!local.releaseId || compareVersions(local.releaseId, CURRENT_RELEASE.id) <= 0) throw new Error("site-not-ready");
    await prepareUpdate(local.releaseId, onPhase);
  } catch (error) {
    const reasons = ["site-not-ready", "resource-unavailable", "entry-version-mismatch", "missing-entry-script", "unexpected-resource-origin", "invalid-resource", "worker-update-timeout", "worker-not-ready", "worker-version-mismatch", "worker-activation-timeout", "worker-message-failed"];
    recordUpdate(9, { failureCode: error instanceof Error ? reasons.indexOf(error.message) + 1 : 0 });
    failUpdate();
    throw error;
  }
}

async function freshResponse(path: string) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("frienden_update", String(Date.now()));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    recordUpdate(13, { httpStatus: response.status, offlineFallback: Boolean(response.headers.get("X-Frienden-Offline")) });
    if (!response.ok || response.headers.get("X-Frienden-Offline")) throw new Error("resource-unavailable");
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, headers: response.headers });
  } finally { window.clearTimeout(timeout); }
}

async function workerRelease(worker: ServiceWorker) {
  return new Promise<string | null>((resolve) => {
    const channel = new MessageChannel();
    const finish = (version: string | null) => { clearTimeout(timeout); channel.port1.close(); resolve(version); };
    const timeout = setTimeout(() => finish(null), 1500);
    channel.port1.onmessage = (event) => finish(typeof event.data?.release === "string" ? event.data.release : null);
    try { worker.postMessage({ type: "GET_RELEASE" }, [channel.port2]); } catch { finish(null); }
  });
}

async function prepareUpdate(target: string, onPhase?: (phase: UpdateActivationPhase) => void) {
  onPhase?.("preparing");
  recordUpdate(10);
  const html = await (await freshResponse("/index.html")).text();
  const page = new DOMParser().parseFromString(html, "text/html");
  const entryVersion = page.querySelector('meta[name="frienden-release"]')?.getAttribute("content") ?? null;
  recordUpdate(3, { entryVersion });
  if (entryVersion !== target) throw new Error("entry-version-mismatch");
  const scripts = Array.from(page.querySelectorAll('script[type="module"][src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]'));
  const resources = scripts.flatMap((node) => {
    const url = new URL(node.getAttribute("src") ?? node.getAttribute("href")!, window.location.origin);
    if (url.origin === window.location.origin) return [url];
    // Optional external font styles must not block an application upgrade.
    if (node.tagName === "LINK" && node.getAttribute("rel") === "stylesheet") return [];
    throw new Error("unexpected-resource-origin");
  });
  if (!resources.length) throw new Error("missing-entry-script");
  recordUpdate(11);
  // Stop at the first failed dependency so no late probes pollute the report.
  for (const url of resources) {
    const response = await freshResponse(`${url.pathname}${url.search}`);
    if (response.headers.get("Content-Type")?.includes("text/html")) throw new Error("invalid-resource");
  }
  recordUpdate(4, { resourceCount: resources.length });
  const registration = "serviceWorker" in navigator
    ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
    : undefined;
  if (registration) {
    recordUpdate(5, { hasWorker: Boolean(registration.waiting), hasController: Boolean(navigator.serviceWorker?.controller) });
    for (let retry = 0; retry < 2; retry++) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      recordUpdate(12, { retry });
      try {
        await Promise.race([
          registration.update(),
          new Promise<void>((_, reject) => { timeout = globalThis.setTimeout(() => reject(new Error("worker-update-timeout")), 10000); }),
        ]);
        break;
      } catch (error) {
        if (retry === 1) throw error;
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      } finally {
        if (timeout) globalThis.clearTimeout(timeout);
      }
    }
  }
  onPhase?.("installing");
  const worker = registration ? await waitForWaitingWorker(registration) : null;
  recordUpdate(5, { hasWorker: Boolean(worker), hasController: Boolean(navigator.serviceWorker?.controller) });
  if (!worker) {
    if (registration) {
      const activeVersion = registration.active ? await workerRelease(registration.active) : null;
      recordUpdate(6, { workerVersion: activeVersion });
      if (activeVersion !== target) throw new Error("worker-not-ready");
    }
    onPhase?.("restarting");
    markUpdateReload();
    window.sessionStorage.setItem("sermo:diagnostics:reload-reason", "user-requested-pwa-update");
    const url = new URL(window.location.href);
    url.searchParams.set("frienden_updated", target);
    window.location.replace(url.href);
    return;
  }
  const version = await workerRelease(worker);
  recordUpdate(6, { workerVersion: version });
  if (version !== target) throw new Error("worker-version-mismatch");
  await new Promise<void>((resolve, reject) => {
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      onPhase?.("restarting");
      window.clearTimeout(fallback);
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      window.sessionStorage.setItem("sermo:diagnostics:reload-reason", "user-requested-pwa-update");
      markUpdateReload();
      const url = new URL(window.location.href);
      url.searchParams.set("frienden_updated", target);
      window.location.replace(url.href);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    const fallback = window.setTimeout(() => { navigator.serviceWorker.removeEventListener("controllerchange", reload); reject(new Error("worker-activation-timeout")); }, 8000);
    try {
      if (navigator.serviceWorker.controller === worker) reload();
      else worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      window.clearTimeout(fallback);
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      reject(new Error("worker-message-failed"));
    }
  });
}
