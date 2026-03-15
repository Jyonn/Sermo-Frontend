import { useEffect, useState, type ReactNode } from "react";
import { useBodyScrollLock } from "../lib/bodyLock";

interface BottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, description, onClose, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  useBodyScrollLock(open);

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
    setDragging(true);
    setStartY(clientY);
  };

  const moveDrag = (clientY: number) => {
    if (!dragging || startY === null) return;
    setDragY(Math.max(0, clientY - startY));
  };

  const endDrag = () => {
    if (!dragging) return;
    if (dragY > 120) {
      onClose();
    } else {
      setDragY(0);
    }
    setDragging(false);
    setStartY(null);
  };

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section
        className={`bottom-sheet ${dragging ? "dragging" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onMouseMove={(event) => moveDrag(event.clientY)}
        onMouseUp={endDrag}
        onTouchEnd={endDrag}
        onTouchMove={(event) => moveDrag(event.touches[0]?.clientY ?? 0)}
        style={{ transform: `translateY(${dragY}px)` }}
        aria-modal="true"
        role="dialog"
      >
        <button className="sheet-close" onClick={onClose} type="button" aria-label="关闭面板">
          <span className="material-symbols-outlined">close</span>
        </button>
        <button
          className="sheet-drag-zone"
          onMouseDown={(event) => startDrag(event.clientY)}
          onTouchStart={(event) => startDrag(event.touches[0]?.clientY ?? 0)}
          type="button"
          aria-label="拖动关闭"
        >
          <div className="sheet-handle" />
        </button>
        <div
          className="sheet-header"
          onMouseDown={(event) => startDrag(event.clientY)}
          onTouchStart={(event) => startDrag(event.touches[0]?.clientY ?? 0)}
        >
          <p className="eyebrow">Sheet</p>
          <h3 className="panel-title">{title}</h3>
          {description ? <p className="card-subtitle">{description}</p> : null}
        </div>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
