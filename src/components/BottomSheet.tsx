import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";

interface BottomSheetProps {
  open: boolean;
  title: string;
  titleAccessory?: ReactNode;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function BottomSheet({
  open,
  title,
  titleAccessory,
  description,
  onClose,
  children,
  header,
  showCloseButton = true,
  className,
  bodyClassName,
}: BottomSheetProps) {
  const [desktopModal, setDesktopModal] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches
  );
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const sync = () => setDesktopModal(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      setStartY(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const startDrag = (clientY: number) => {
    if (desktopModal) return;
    setDragging(true);
    setStartY(clientY);
  };

  const moveDrag = (clientY: number) => {
    if (desktopModal || !dragging || startY === null) return;
    setDragY(Math.max(0, clientY - startY));
  };

  const endDrag = () => {
    if (desktopModal || !dragging) return;
    if (dragY > 120) {
      onClose();
    } else {
      setDragY(0);
    }
    setDragging(false);
    setStartY(null);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section
        className={`bottom-sheet ${dragging ? "dragging" : ""} ${className ?? ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        onMouseMove={desktopModal ? undefined : (event) => moveDrag(event.clientY)}
        onMouseUp={desktopModal ? undefined : endDrag}
        onTouchEnd={desktopModal ? undefined : endDrag}
        onTouchMove={desktopModal ? undefined : (event) => moveDrag(event.touches[0]?.clientY ?? 0)}
        style={desktopModal ? undefined : { transform: `translateY(${dragY}px)` }}
        aria-modal="true"
        role="dialog"
      >
        {showCloseButton ? (
          <button className="sheet-close" onClick={onClose} type="button" aria-label="关闭面板">
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
        {!desktopModal ? (
          <button
            className="sheet-drag-zone"
            onMouseDown={(event) => startDrag(event.clientY)}
            onTouchStart={(event) => startDrag(event.touches[0]?.clientY ?? 0)}
            type="button"
            aria-label="拖动关闭"
          >
            <div className="sheet-handle" />
          </button>
        ) : null}
        {header ? (
          <div className="sheet-header custom-sheet-header">{header}</div>
        ) : (
          <div
            className="sheet-header"
            onMouseDown={desktopModal ? undefined : (event) => startDrag(event.clientY)}
            onTouchStart={desktopModal ? undefined : (event) => startDrag(event.touches[0]?.clientY ?? 0)}
          >
            <p className="eyebrow">Sheet</p>
            <div className="sheet-title-row">
              <h3 className="panel-title">{title}</h3>
              {titleAccessory}
            </div>
            {description ? <p className="card-subtitle">{description}</p> : null}
          </div>
        )}
        <div className={`sheet-body ${bodyClassName ?? ""}`.trim()}>{children}</div>
      </section>
    </div>,
    document.body
  );
}
