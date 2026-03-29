import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";

type RequestStatusPhase = "loading" | "success" | "error";

interface RequestStatusModalProps {
  open: boolean;
  phase: RequestStatusPhase;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  onAutoClose?: () => void;
}

export function RequestStatusModal({
  open,
  phase,
  loadingLabel,
  successLabel,
  errorLabel,
  onAutoClose,
}: RequestStatusModalProps) {
  useBodyScrollLock(open);

  const label = phase === "loading" ? loadingLabel : phase === "success" ? successLabel : errorLabel;

  useEffect(() => {
    if (!open || phase === "loading" || !onAutoClose) return;
    const timer = window.setTimeout(() => {
      onAutoClose();
    }, 780);
    return () => window.clearTimeout(timer);
  }, [onAutoClose, open, phase]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop request-status-backdrop" role="presentation">
      <section aria-live="polite" className={`request-status-modal is-${phase}`} role="status">
        <div className="request-status-stage">
          <div className="request-status-spinner" />
          <svg className="request-status-mark request-status-check" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M8 16.5 13.5 22 24 11" />
          </svg>
          <svg className="request-status-mark request-status-cross" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M10 10 22 22" />
            <path d="M22 10 10 22" />
          </svg>
        </div>
        {label ? <p className="request-status-label">{label}</p> : null}
      </section>
    </div>,
    document.body
  );
}
