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
  const updateAvailable = !release?.id || release.id !== currentRelease.id;
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
