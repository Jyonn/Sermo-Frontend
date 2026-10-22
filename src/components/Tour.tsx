import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";
import { useModalFocus } from "../lib/modalFocus";
import { useBodyScrollLock } from "../lib/bodyLock";
import { tourPosition } from "../lib/interactionPatterns";
import "./InteractionPatterns.css";

export interface TourStep { target: () => HTMLElement | null; title: string; description: string; }

export function Tour({ open, steps, onClose }: { open: boolean; steps: TourStep[]; onClose: () => void }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [layout, setLayout] = useState({ width: window.innerWidth, height: window.innerHeight, cardHeight: 240 });
  const root = useRef<HTMLElement | null>(null);
  const titleId = useId(); const descriptionId = useId();
  const step = steps[index];
  useBodyScrollLock(open);
  useModalFocus(root, open, onClose);
  useLayoutEffect(() => { if (!open) setIndex(0); }, [open]);
  useLayoutEffect(() => {
    if (!open || !step) return;
    const target = step.target();
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const sync = () => {
      const box = target?.getBoundingClientRect();
      setRect(box && box.width && box.height ? box : null);
      setLayout({ width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight, cardHeight: root.current?.offsetHeight ?? 240 });
    };
    sync();
    const observer = new ResizeObserver(sync);
    if (target) observer.observe(target);
    if (root.current) observer.observe(root.current);
    window.addEventListener("resize", sync); window.addEventListener("scroll", sync, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", sync); window.removeEventListener("scroll", sync, true); };
  }, [open, step]);
  if (!open || !step) return null;
  const position = tourPosition(rect, layout.width, layout.height, layout.cardHeight);
  return createPortal(<div className={`tour-layer${rect ? " has-target" : ""}`}>
    {rect ? <div className="tour-spotlight" aria-hidden="true" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} /> : null}
    <section className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} ref={root} style={position}>
      <small>{t("patterns.step", { current: index + 1, total: steps.length })}</small><h2 id={titleId}>{step.title}</h2><p id={descriptionId}>{step.description}</p>
      <footer><button className="ghost-button" type="button" onClick={onClose}>{t("patterns.skip")}</button><div>{index > 0 ? <button className="ghost-button" type="button" onClick={() => setIndex(index - 1)}>{t("patterns.previous")}</button> : null}<button className="button" type="button" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{t(index === steps.length - 1 ? "patterns.done" : "common.next")}</button></div></footer>
    </section>
  </div>, document.body);
}
