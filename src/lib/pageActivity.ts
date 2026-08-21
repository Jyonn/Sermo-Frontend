import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let listening = false;

function readPageActive() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function notifyPageActivity() {
  listeners.forEach((listener) => listener());
}

function startListening() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", notifyPageActivity);
}

function stopListening() {
  if (!listening || listeners.size || typeof document === "undefined") return;
  listening = false;
  document.removeEventListener("visibilitychange", notifyPageActivity);
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  startListening();
  return () => {
    listeners.delete(listener);
    stopListening();
  };
}

export function usePageActive() {
  return useSyncExternalStore(subscribe, readPageActive, () => true);
}

export function isPageActive() {
  return readPageActive();
}
