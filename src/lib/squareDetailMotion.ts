export interface DetailRect { left: number; top: number; width: number; height: number }

export function detailMotionGeometry(origin: DetailRect, target: DetailRect, viewport: { width: number; height: number }) {
  const scale = origin.width / Math.max(1, target.width);
  return {
    transform: `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${scale})`,
    clipPath: `inset(${Math.max(0, origin.top)}px ${Math.max(0, viewport.width - origin.left - origin.width)}px ${Math.max(0, viewport.height - origin.top - origin.height)}px ${Math.max(0, origin.left)}px round 12px)`,
  };
}

export interface DetailMotionNodes {
  surface: HTMLElement;
  card: HTMLElement;
  header: HTMLElement | null;
  discussion: HTMLElement | null;
  dock: HTMLElement | null;
  mask: HTMLElement | null;
}

// Decode before exposing the new surface, but never hold navigation on the network.
export async function prepareDetailImages(surface: HTMLElement, signal: AbortSignal) {
  if (signal.aborted) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const images = Array.from(surface.querySelectorAll("img"));
  try {
    await Promise.race([
      Promise.all(images.map((image) => image.decode().catch(() => undefined))),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 240); }),
      new Promise<void>((resolve) => { abort = () => resolve(); signal.addEventListener("abort", abort, { once: true }); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal.removeEventListener("abort", abort);
  }
}

export function animateSquareDetail(nodes: DetailMotionNodes, origin: DetailRect | null, closing = false, interrupted = false) {
  const { surface, card, header, discussion, dock, mask } = nodes;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const surfaceRect = surface.getBoundingClientRect();
  const target = { left: surfaceRect.left + card.offsetLeft, top: surfaceRect.top + card.offsetTop - surface.scrollTop, width: card.offsetWidth, height: card.offsetHeight };
  const geometry = origin ? detailMotionGeometry(origin, target, viewport) : null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : closing ? 340 : 460;
  const animations: Animation[] = [];
  const animate = (element: HTMLElement | null, frames: Keyframe[]) => {
    if (!element) return;
    // Capture an interrupted opening before cancelling it so Back never snaps.
    if (closing && interrupted) {
      const computed = getComputedStyle(element);
      const first = { ...frames[0] };
      for (const property of Object.keys(first)) {
        if (property === "opacity" || property === "transform" || property === "clipPath") first[property] = computed[property];
      }
      frames[0] = first;
    }
    const animation = element.animate(frames, {
      duration, easing: closing ? "cubic-bezier(.4,0,.8,.3)" : "cubic-bezier(.2,.8,.2,1)", fill: "both",
    });
    animations.push(animation);
  };
  const clip = geometry?.clipPath ?? "inset(0px 0px 0px 0px round 0px)";
  const transform = geometry?.transform ?? "translate(0px, 22px) scale(1)";
  const pair = (from: Keyframe, to: Keyframe) => closing ? [to, from] : [from, to];
  animate(surface, pair({ clipPath: clip, opacity: geometry ? 1 : 0 }, { clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 }));
  animate(card, pair({ transform }, { transform: "translate(0px, 0px) scale(1)" }));
  for (const element of [header, discussion, dock]) {
    animate(element, pair({ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0px)" }));
  }
  animate(mask, pair({ opacity: 0 }, { opacity: 1 }));
  // All layers share a clock rather than independent CSS delays/timers.
  const start = document.timeline.currentTime;
  if (start !== null) animations.forEach((animation) => { animation.startTime = start; });
  return {
    finished: Promise.all(animations.map((animation) => animation.finished)),
    cancel: () => animations.forEach((animation) => animation.cancel()),
  };
}
