export const PWA_UPDATE_AVAILABLE_EVENT = "sermo:pwa-update-available";

let waitingWorker: ServiceWorker | null = null;

function announceUpdate(worker: ServiceWorker) {
  waitingWorker = worker;
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT));
}

export function watchPwaUpdates(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    announceUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        announceUpdate(worker);
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
