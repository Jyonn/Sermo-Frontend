import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";

interface SideDrawerProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  onAction?: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function SideDrawer({
  open,
  title,
  eyebrow,
  description,
  actionLabel,
  actionDisabled = false,
  actionBusy = false,
  onAction,
  onClose,
  children,
}: SideDrawerProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside aria-modal="true" className="side-drawer" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="drawer-topbar">
          <div className="chat-conversation-topbar drawer-topbar-shell">
            <button className="chat-back-button drawer-back-button" onClick={onClose} type="button" aria-label="返回">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="drawer-topbar-copy">
              <div className="drawer-topbar-meta">
                {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                <h3 className="drawer-title">{title}</h3>
                {description ? <p className="drawer-description">{description}</p> : null}
              </div>
            </div>
            {actionLabel && onAction ? (
              <button
                className="drawer-topbar-action"
                disabled={actionDisabled || actionBusy}
                onClick={onAction}
                type="button"
              >
                {actionBusy ? "处理中..." : actionLabel}
              </button>
            ) : null}
          </div>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
