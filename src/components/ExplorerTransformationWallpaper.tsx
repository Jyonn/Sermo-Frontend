import { useEffect, useId, useRef } from "react";
import { EXPLORER_SILHOUETTES, explorerPortraitBounds, explorerSceneLayout } from "../lib/explorerMotion";
import { EXPLORER_ART } from "../lib/explorer";
import { createExplorerMotionLease, createExplorerPlayback, explorerMotionAllowed, EXPLORER_TRANSITION_MS } from "../lib/explorerPlayback";

const lease = createExplorerMotionLease();
const portraits = (["conan", "shinichi"] as const).map((name, index) => ({
  name, index, bounds: explorerPortraitBounds(name),
  image: index === 0 ? EXPLORER_ART.background : EXPLORER_ART.backgroundAlternate,
}));

export function ExplorerTransformationWallpaper({ compact }: { compact: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as Navigator & { connection?: { saveData?: boolean } };
    const allowed = () => typeof root.animate === "function" && explorerMotionAllowed({ reduced: reduced.matches, saveData: device.connection?.saveData });
    const key = Symbol("explorer-transformation");
    let disposed = false, visible = false, loading = false, loaded = false, failed = false, registered = false;
    const player = createExplorerPlayback({
      timer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (timer) => window.clearTimeout(timer),
    }, (_from, to) => {
      const animations: Animation[] = [];
      const options = { duration: EXPLORER_TRANSITION_MS, fill: "both" as const };
      stage.dataset.motion = "gold-flash";
      try {
        for (const actor of stage.querySelectorAll<SVGSVGElement>(".explorer-transformation-actor")) {
          const incoming = Number(actor.dataset.index) === to;
          const opacity = incoming ? [0, 0, 1, 1] : [1, 1, 0, 0];
          animations.push(actor.animate(opacity.map((value, index) => ({ opacity: value, offset: [0, .46, .54, 1][index] })), options));
          const gold = actor.querySelector<SVGGElement>(".explorer-transformation-gold");
          if (gold) animations.push(gold.animate([
            { opacity: 0, offset: 0 }, { opacity: .65, offset: .22 },
            { opacity: 1, offset: .42 }, { opacity: 1, offset: .60 },
            { opacity: .3, offset: .8 }, { opacity: 0, offset: 1 },
          ], options));
        }
      } catch (error) {
        for (const animation of animations) animation.cancel();
        throw error;
      }
      return () => { for (const animation of animations) animation.cancel(); };
    }, (portrait) => {
      stage.dataset.portrait = String(portrait);
      stage.dataset.motion = "still";
    });
    const leave = () => { if (registered) { registered = false; lease.leave(key); } };
    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      const layout = explorerSceneLayout(width, height);
      stage.style.width = layout.width + "px";
      stage.style.height = layout.height + "px";
      stage.style.left = layout.left + "px";
      stage.style.top = layout.top + "px";
      stage.style.setProperty("--explorer-figure-scale", String(layout.figureScale));
    };
    const load = (src: string) => { const image = new Image(); image.decoding = "async"; image.src = src; return image.decode(); };
    const prepare = () => {
      if (loading || failed || disposed) return;
      loading = true;
      void Promise.all([load(EXPLORER_ART.background), load(EXPLORER_ART.backgroundAlternate), load("/activity/explorer-2026/roof-night-v4.webp")]).then(() => {
        if (disposed) return;
        loaded = true;
        resize(); update();
      }).catch(() => { failed = true; root.dataset.ready = "false"; leave(); });
    };
    const update = () => {
      const canRun = allowed() && !failed;
      root.dataset.ready = loaded && canRun ? "true" : "false";
      if (!visible || document.visibilityState !== "visible" || !canRun) { leave(); return; }
      if (!loaded) { prepare(); return; }
      if (!registered) { registered = true; lease.enter(key, (active) => active ? player.start() : player.stop()); }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(root); resizeObserver.observe(root);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    return () => {
      disposed = true; leave(); player.stop();
      observer.disconnect(); resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return <div ref={rootRef} aria-hidden="true" className={`explorer-living-wallpaper${compact ? " is-compact" : ""}`}>
    <img className="explorer-wallpaper-still" alt="" src={EXPLORER_ART.background} decoding="async" />
    <div ref={stageRef} className="explorer-transformation-stage" data-portrait="0">
      {portraits.map(({ name, index, bounds, image }) => <svg key={name}
        className="explorer-transformation-actor" data-index={index}
        style={{ left: `${bounds.left / 960 * 100}%`, top: `${bounds.top / 1440 * 100}%`, width: `${bounds.width / 960 * 100}%`, height: `${bounds.height / 1440 * 100}%`, transformOrigin: `${(740 - bounds.left) / bounds.width * 100}% ${(1266 - bounds.top) / bounds.height * 100}%` }}
        viewBox={`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`}>
        <defs>
          <clipPath id={`${id}-${name}-clip`}>{EXPLORER_SILHOUETTES[name].map((polygon, part) => <polygon key={part} points={polygon.map((point) => point.join(",")).join(" ")} />)}</clipPath>
          <linearGradient id={`${id}-${name}-gold`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff4b2" /><stop offset=".48" stopColor="#ffda67" /><stop offset="1" stopColor="#d89a28" />
          </linearGradient>
        </defs>
        <image href={image} width="960" height="1440" clipPath={`url(#${id}-${name}-clip)`} />
        <g className="explorer-transformation-gold" fill={`url(#${id}-${name}-gold)`} stroke="#ffeaa5" strokeWidth="6" strokeLinejoin="round">
          {EXPLORER_SILHOUETTES[name].map((polygon, part) => <polygon key={part} points={polygon.map((point) => point.join(",")).join(" ")} />)}
        </g>
      </svg>)}
    </div>
  </div>;
}
