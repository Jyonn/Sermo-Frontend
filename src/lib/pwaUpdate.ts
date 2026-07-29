export const PWA_UPDATE_AVAILABLE_EVENT = "sermo:pwa-update-available";

export interface ReleaseNotes {
  id: string;
  publishedAt: string;
  locales: Record<string, {
    title: string;
    items: string[];
  }>;
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
  waitingWorker = worker;
  const release = await getReleaseNotes();
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, { detail: release }));
}

export function watchPwaUpdates(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    void announceUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        void announceUpdate(worker);
      }
    });
  });
}

export function activatePwaUpdate() {
  const worker = waitingWorker;
  if (!worker) return false;
  worker.postMessage({ type: "SKIP_WAITING" });
  return true;
}
