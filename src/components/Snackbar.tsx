import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { InlineAlert } from "./InlineAlert";
import "./InteractionPatterns.css";

export function Snackbar({ open, message, actionLabel, onAction, onClose, duration = 6000 }: { open: boolean; message: string; actionLabel: string; onAction: () => void | Promise<void>; onClose: () => void; duration?: number }) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const paused = hovered || focused || hidden;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);
  const remaining = useRef(duration);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { if (open) { setHovered(false); setFocused(false); setHidden(document.hidden); } }, [open]);
  useEffect(() => { if (open) { remaining.current = Math.max(4000, duration); setError(false); } }, [open, duration, message]);
  useEffect(() => {
    if (!open || paused || busy || error) return;
    const start = Date.now();
    const timer = window.setTimeout(() => close.current(), remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - start)); };
  }, [open, paused, busy, error, message]);
  useEffect(() => { const sync = () => setHidden(document.hidden); document.addEventListener("visibilitychange", sync); return () => document.removeEventListener("visibilitychange", sync); }, []);
  if (!open) return null;
  return createPortal(<div className="snackbar-viewport"><div className="snackbar" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <span role="status">{message}</span><button disabled={busy} type="button" onClick={async () => { if (running.current) return; running.current = true; setBusy(true); try { await onAction(); onClose(); } catch { setError(true); } finally { running.current = false; setBusy(false); } }}>{busy ? t("common.processing") : actionLabel}</button>
    <button className="snackbar-close" disabled={busy} aria-label={t("common.close")} type="button" onClick={onClose}>×</button>
    {error ? <InlineAlert>{t("patterns.actionFailed")}</InlineAlert> : null}
  </div></div>, document.body);
}
