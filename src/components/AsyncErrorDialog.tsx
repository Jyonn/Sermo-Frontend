import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";

interface AsyncErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
  confirmLabel?: string;
  retryLabel?: string;
  extra?: ReactNode;
}

export function AsyncErrorDialog({
  open,
  title,
  message,
  onClose,
  onRetry,
  confirmLabel,
  retryLabel,
  extra,
}: AsyncErrorDialogProps) {
  const { t } = useI18n();
  useBodyScrollLock(open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className="async-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="async-dialog-icon" aria-hidden="true">
          <span className="material-symbols-outlined">error</span>
        </div>
        <div className="async-dialog-copy">
          <h2>{title ?? t("common.operationFailed")}</h2>
          <p>{message}</p>
          {extra}
        </div>
        <div className="async-dialog-actions">
          {onRetry ? (
            <button className="ghost-button" onClick={onRetry} type="button">
              {retryLabel ?? t("common.retry")}
            </button>
          ) : null}
          <button className="button" onClick={onClose} type="button">
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
