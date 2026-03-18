import { useEffect, type ReactNode } from "react";
import { useBodyScrollLock } from "../lib/bodyLock";

interface SideDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function SideDrawer({ open, title, description, onClose, children }: SideDrawerProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside aria-modal="true" className="side-drawer" onClick={(event) => event.stopPropagation()} role="dialog">
        <button className="sheet-close" onClick={onClose} type="button" aria-label="关闭抽屉">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="drawer-header">
          <p className="eyebrow">Drawer</p>
          <h3 className="panel-title">{title}</h3>
          {description ? <p className="card-subtitle">{description}</p> : null}
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
