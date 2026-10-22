import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";
import { useModalFocus } from "../lib/modalFocus";

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
  kind?: "modal" | "alert";
  dismissible?: boolean;
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
  kind = "modal",
  dismissible = true,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const root = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open);
  useModalFocus(root, open, () => { if (dismissible && !busy) onClose(); });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop confirm-dialog-backdrop" onClick={() => { if (dismissible && !busy) onClose(); }} role="presentation">
      <section ref={root} tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId} aria-modal="true" className="confirm-dialog" onClick={(event) => event.stopPropagation()} role={kind === "alert" ? "alertdialog" : "dialog"}>
        <div className="confirm-dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
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
