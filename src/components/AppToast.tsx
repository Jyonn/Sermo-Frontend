import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_TOAST_EVENT, type ToastDetail } from "../lib/toast";

export function AppToast() {
  const [queue, setQueue] = useState<ToastDetail[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const enqueue = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      setQueue((items) => [...items, detail]);
    };
    window.addEventListener(APP_TOAST_EVENT, enqueue);
    return () => window.removeEventListener(APP_TOAST_EVENT, enqueue);
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => {
      setQueue((items) => items.filter((item) => item.id !== current.id));
    }, current.duration);
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current || typeof document === "undefined") return null;

  return createPortal(
    <div className="app-toast-viewport" aria-live="polite" aria-atomic="true">
      <div className={`app-toast is-${current.tone}`} key={current.id} role={current.tone === "error" ? "alert" : "status"}>
        <span className="app-toast-mark" aria-hidden="true">
          {current.tone === "success" ? (
            <svg viewBox="0 0 20 20"><path d="m5 10.5 3.1 3.1L15.5 6.5" /></svg>
          ) : current.tone === "error" ? (
            <svg viewBox="0 0 20 20"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" /></svg>
          ) : (
            <span>i</span>
          )}
        </span>
        <span>{current.message}</span>
      </div>
    </div>,
    document.body
  );
}
