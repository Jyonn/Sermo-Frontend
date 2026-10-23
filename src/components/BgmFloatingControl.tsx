import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { BgmIcon } from "./BgmIcon";

export function BgmFloatingControl({ remaining, busy, hidden = false, onOpen }: { remaining: number; busy: boolean; hidden?: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [anchor, setAnchor] = useState({ right: true, ratio: 0.7 });
  const [moving, setMoving] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBounds({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const maxX = Math.max(0, bounds.width - 56);
  const maxY = Math.max(0, bounds.height - 56);
  const left = moving?.left ?? (anchor.right ? maxX : 0);
  const top = moving?.top ?? maxY * anchor.ratio;
  const locked = remaining > 0 || busy;
  const label = remaining > 0 ? t("bgm.floatingCooldown", { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` }) : t("bgm.pressToEnter");
  return <div className="bgm-float-area" style={{ visibility: hidden ? "hidden" : undefined }} aria-hidden={hidden || undefined} ref={area}><button tabIndex={hidden ? -1 : 0} className={`bgm-float${moving ? " is-dragging" : ""}${locked ? " is-cooling" : ""}`} style={{ transform: `translate(${left}px, ${top}px)` }} aria-label={label} title={label} aria-disabled={locked} onPointerDown={(event) => {
    if (event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: event.clientX, y: event.clientY, left, top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    const start = drag.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
    if (start.moved) setMoving({ left: Math.max(0, Math.min(maxX, start.left + event.clientX - start.x)), top: Math.max(0, Math.min(maxY, start.top + event.clientY - start.y)) });
  }} onLostPointerCapture={() => { if (drag.current?.moved) suppressClick.current = true; drag.current = null; setMoving(null); }} onPointerUp={(event) => {
    const start = drag.current;
    if (!start) return;
    suppressClick.current = start.moved;
    const x = Math.max(0, Math.min(maxX, start.left + event.clientX - start.x));
    const y = Math.max(0, Math.min(maxY, start.top + event.clientY - start.y));
    if (start.moved) setAnchor({ right: x >= maxX / 2, ratio: maxY ? y / maxY : 0 });
    setMoving(null); drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }} onPointerCancel={() => { drag.current = null; setMoving(null); suppressClick.current = true; }} onClick={() => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!locked) onOpen();
  }} type="button"><BgmIcon name="music_note" />{remaining > 0 ? <span aria-hidden="true">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span> : null}</button></div>;
}
