import { useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ComposerActionsPopover({ open, anchor, onClose, children, label }: {
  open: boolean; anchor: RefObject<HTMLButtonElement | null>; onClose: () => void; children: ReactNode; label: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  const [position, setPosition] = useState({ left: 0, bottom: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect) setPosition({ left: Math.max(12, Math.min(window.innerWidth - 292, rect.right - 280)), bottom: window.innerHeight - rect.top + 12 });
    };
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); anchor.current?.focus(); }
    };
    update();
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    window.addEventListener("resize", update);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, anchor]);
  return open ? createPortal(<div className="composer-actions-popover" role="dialog" aria-label={label} ref={panel} style={position}>{children}</div>, document.body) : null;
}
