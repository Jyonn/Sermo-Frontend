import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  danger?: boolean;
  warning?: boolean;
  showCancelButton?: boolean;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  confirmDisabled = false,
  danger = false,
  warning = false,
  showCancelButton = true,
  children,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onConfirm, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop confirm-dialog-backdrop" onClick={onClose} role="presentation">
      <section aria-modal="true" className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="confirm-dialog-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {children}
        <div className="confirm-dialog-actions">
          {showCancelButton ? (
            <button className="ghost-button" disabled={busy} onClick={onClose} type="button">
              {cancelLabel ?? t("common.cancel")}
            </button>
          ) : null}
          <button className={danger ? "danger-button" : warning ? "warning-button" : "button"} disabled={busy || confirmDisabled} onClick={onConfirm} type="button">
            {busy ? `${t("common.loading")}...` : confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
