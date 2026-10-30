import { useEffect, useRef } from "react";
import { EXPLORER_SILHOUETTES, explorerPortraitPixels } from "../lib/explorerMotion";
import type { ExplorerPortrait } from "../lib/explorerMotion";
import { EXPLORER_ART } from "../lib/explorer";
import { createExplorerMotionLease, createExplorerPlayback, explorerMotionAllowed, explorerRasterBudget } from "../lib/explorerPlayback";

const lease = createExplorerMotionLease();
const portraits = (["conan", "shinichi"] as const).map((name) => ({ name, pixels: explorerPortraitPixels(name) }));
const coordinates = portraits.flatMap(({ pixels }) => pixels.flatMap((pixel) => [[pixel.x, pixel.y], ...pixel.curve.map(([x,y]) => [pixel.x + x, pixel.y + y])]));
const motionBounds = { left: Math.min(...coordinates.map(([x]) => x)) - 18, top: Math.min(...coordinates.map(([,y]) => y)) - 18, right: Math.max(...coordinates.map(([x]) => x)) + 18, bottom: Math.max(...coordinates.map(([,y]) => y)) + 18 };
type Texture = { canvas: HTMLCanvasElement; left: number; top: number; width: number; height: number };

function portraitTexture(image: HTMLImageElement, name: ExplorerPortrait, pixels: ReturnType<typeof explorerPortraitPixels>): Texture {
  const left = Math.min(...pixels.map((p) => p.x));
  const top = Math.min(...pixels.map((p) => p.y));
  const width = Math.max(...pixels.map((p) => p.x + p.size)) - left;
  const height = Math.max(...pixels.map((p) => p.y + p.size)) - top;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.translate(-left, -top);
  ctx.beginPath();
  for (const polygon of EXPLORER_SILHOUETTES[name]) {
    polygon.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
  }
  ctx.clip();
  ctx.drawImage(image, 0, 0, 960, 1440);
  return { canvas, left, top, width, height };
}

export function ExplorerPixelWallpaper({ compact }: { compact: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const allowed = () => explorerMotionAllowed({ reduced: reduced.matches, saveData: device.connection?.saveData, cores: device.hardwareConcurrency, memory: device.deviceMemory });
    if (!allowed()) return; // Static portrait, no extra image decoding or animation.
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const key = Symbol("explorer-wallpaper");
    let disposed = false;
    let visible = false;
    let loading = false;
    let failed = false;
    let registered = false;
    let textures: Texture[] = [];
    let scale = 1, originX = 0, originY = 0;
    let slowFrames = 0;
    let paintedFrames = 0, totalPaintMs = 0, maxPaintMs = 0;
    let transitioning = false;
    const clear = () => { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(scale,0,0,scale,originX,originY); ctx.imageSmoothingEnabled = false; };
    const rest = (portrait: number) => {
      if (!textures.length || disposed) return;
      clear(); const texture = textures[portrait]; ctx.globalAlpha = 1; ctx.drawImage(texture.canvas, texture.left, texture.top);
      transitioning = false;
      // Diagnostics update only at rest, never on every animation frame.
      canvas.dataset.motion = "still";
      canvas.dataset.frames = String(paintedFrames);
      canvas.dataset.averagePaintMs = (totalPaintMs / Math.max(1, paintedFrames)).toFixed(2);
      canvas.dataset.maxPaintMs = maxPaintMs.toFixed(2);
    };
    const player = createExplorerPlayback({
      now: () => performance.now(),
      timer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (id) => window.clearTimeout(id),
      frame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
    }, (from, to, progress) => {
      const began = performance.now();
      if (!transitioning) { transitioning = true; canvas.dataset.motion = "transition"; }
      clear();
      for (const [portrait, incoming] of [[from, false], [to, true]] as const) {
        const texture = textures[portrait];
        for (const pixel of portraits[portrait].pixels) {
          const q = Math.max(0, Math.min(1, (incoming ? 1 - progress : progress) * 1.2 - (incoming ? .32 - pixel.lag : pixel.lag) * .5));
          const alpha = Math.max(0, 1 - q * 1.1);
          if (alpha < .02) continue;
          const u = 1 - q;
          const [a,b,end] = pixel.control;
          const dx = 3*u*u*q*a[0] + 3*u*q*q*b[0] + q*q*q*end[0];
          const dy = 3*u*u*q*a[1] + 3*u*q*q*b[1] + q*q*q*end[1];
          const size = pixel.size * (1 - .75*q);
          ctx.globalAlpha = alpha;
          ctx.drawImage(texture.canvas, pixel.x - texture.left, pixel.y - texture.top, pixel.size, pixel.size, pixel.x + dx + (pixel.size-size)/2, pixel.y + dy + (pixel.size-size)/2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      const elapsed = performance.now() - began;
      paintedFrames++; totalPaintMs += elapsed; maxPaintMs = Math.max(maxPaintMs, elapsed);
      slowFrames = elapsed > 12 ? slowFrames + 1 : 0;
      return slowFrames < 3;
    }, rest);
    const leave = () => { if (registered) { registered = false; lease.leave(key); } };
    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      const cover = Math.max(width / 960, height / 1440);
      const x = (width - 960 * cover) / 2, y = (height - 1440 * cover) / 2;
      const left = Math.max(0, x + motionBounds.left * cover), top = Math.max(0, y + motionBounds.top * cover);
      const right = Math.min(width, x + motionBounds.right * cover), bottom = Math.min(height, y + motionBounds.bottom * cover);
      const w = Math.max(1, right - left), h = Math.max(1, bottom - top);
      const budget = explorerRasterBudget(w,h);
      canvas.width = budget.width; canvas.height = budget.height;
      canvas.style.left = left + "px"; canvas.style.top = top + "px";
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      // Backing pixels are capped independently of devicePixelRatio.
      scale = cover * budget.scale; originX = (x-left)*budget.scale; originY = (y-top)*budget.scale;
      player.stop();
    };
    const load = (src: string) => { const image = new Image(); image.decoding = "async"; image.src = src; return image.decode().then(() => image); };
    const prepare = () => {
      if (loading || failed || disposed) return;
      loading = true;
      void Promise.all([load(EXPLORER_ART.background), load(EXPLORER_ART.backgroundAlternate), load("/activity/explorer-2026/roof-night-v4.webp")]).then((images) => {
        if (disposed) return;
        textures = portraits.map(({name,pixels}, index) => portraitTexture(images[index],name,pixels));
        resize(); update();
      }).catch(() => { failed = true; root.dataset.ready = "false"; leave(); });
    };
    const update = () => {
      const canRun = allowed() && !failed;
      root.dataset.ready = textures.length && canRun ? "true" : "false";
      if (!visible || document.visibilityState !== "visible" || !canRun) { leave(); return; }
      if (!textures.length) { prepare(); return; }
      if (!registered) { registered = true; lease.enter(key, (active) => active ? player.start() : player.stop()); }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    const resizeObserver = new ResizeObserver(() => { leave(); resize(); update(); });
    observer.observe(root); resizeObserver.observe(root);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    return () => {
      disposed = true; leave(); player.stop();
      observer.disconnect(); resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
      for (const texture of textures) { texture.canvas.width = 0; texture.canvas.height = 0; }
      textures = []; canvas.width = canvas.height = 0;
    };
  }, []);
  return <div ref={rootRef} aria-hidden="true" className={`explorer-living-wallpaper${compact ? " is-compact" : ""}`}>
    <img className="explorer-wallpaper-still" alt="" src={EXPLORER_ART.background} decoding="async" />
    <canvas ref={canvasRef} className="explorer-portrait-canvas" />
  </div>;
}
