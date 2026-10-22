import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/bodyLock";
import { useI18n } from "../lib/language";
import { useModalFocus } from "../lib/modalFocus";
import { sheetRelease, sheetStops } from "../lib/interactionPatterns";
import "./InteractionPatterns.css";

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
  snapPoints?: number[];
  initialSnap?: number;
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
  snapPoints,
  initialSnap = 1,
}: BottomSheetProps) {
  const { t } = useI18n();
  const root = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const dragged = useRef(false);
  const stops = sheetStops(snapPoints ?? []);
  const [stop, setStop] = useState(Math.max(0, Math.min(initialSnap, stops.length - 1)));
  const [desktopModal, setDesktopModal] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches
  );
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  useBodyScrollLock(open);
  useModalFocus(root, open, onClose);

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
      setStop(Math.max(0, Math.min(initialSnap, stops.length - 1)));
    }
  }, [open]);

  const startDrag = (clientY: number) => {
    if (desktopModal) return;
    dragged.current = false;
    setDragging(true);
    setStartY(clientY);
  };

  const moveDrag = (clientY: number) => {
    if (desktopModal || !dragging || startY === null) return;
    const delta = clientY - startY;
    if (Math.abs(delta) > 6) dragged.current = true;
    setDragY(snapPoints ? delta * (delta < 0 && stop === stops.length - 1 ? 0.25 : 1) : Math.max(0, delta));
  };

  const endDrag = () => {
    if (desktopModal || !dragging) return;
    if (snapPoints) {
      const next = sheetRelease(stops, stop, dragY, window.innerHeight);
      if (next === null) onClose();
      else setStop(next);
      setDragY(0);
    } else if (dragY > 120) {
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
        ref={root}
        tabIndex={-1}
        className={`bottom-sheet ${snapPoints && !desktopModal ? "has-detents" : ""} ${dragging ? "dragging" : ""} ${className ?? ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        onPointerMove={desktopModal ? undefined : (event) => moveDrag(event.clientY)}
        onPointerUp={desktopModal ? undefined : endDrag}
        onPointerCancel={() => { setDragging(false); setStartY(null); setDragY(0); }}
        style={desktopModal ? undefined : { transform: `translateY(${dragY}px)`, ...(snapPoints ? { height: `${stops[stop] * 100}dvh`, maxHeight: "90dvh" } : {}) }}
        aria-label={title}
        aria-modal="true"
        role="dialog"
      >
        {showCloseButton ? (
          <button className="sheet-close" onClick={onClose} type="button" aria-label={t("common.closePanel")}>
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
        {!desktopModal ? (
          <button
            className="sheet-drag-zone"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); startDrag(event.clientY); }}
            type="button"
            onClick={() => { if (snapPoints && !dragged.current) setStop((current) => (current + 1) % stops.length); }}
            aria-label={t(snapPoints ? "patterns.resizeSheet" : "common.dragToClose")}
          >
            <div className="sheet-handle" />
          </button>
        ) : null}
        {header ? (
          <div className="sheet-header custom-sheet-header">{header}</div>
        ) : (
          <div
            className="sheet-header"
            onPointerDown={desktopModal ? undefined : (event) => { if ((event.target as HTMLElement).closest('button,input,a,select,textarea')) return; event.currentTarget.setPointerCapture(event.pointerId); startDrag(event.clientY); }}
          >
            <div className="sheet-title-row">
              <h3 id={titleId} className="panel-title">{title}</h3>
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
