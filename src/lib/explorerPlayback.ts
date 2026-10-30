export const EXPLORER_HOLD_MS = 16_000;
export const EXPLORER_TRANSITION_MS = 2_000;
export const EXPLORER_FRAME_MS = 1000 / 30;
export const EXPLORER_CANVAS_PIXELS = 160_000;
export const EXPLORER_CANVAS_SIDE = 512;

export function explorerRasterBudget(width: number, height: number) {
  const scale = Math.min(1, EXPLORER_CANVAS_SIDE / Math.max(1, width), EXPLORER_CANVAS_SIDE / Math.max(1, height), Math.sqrt(EXPLORER_CANVAS_PIXELS / Math.max(1, width * height)));
  return { scale, width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function explorerMotionAllowed(device: { reduced: boolean; saveData?: boolean; cores?: number; memory?: number }) {
  return !device.reduced && !device.saveData && !(device.cores && device.cores <= 4) && !(device.memory && device.memory <= 4);
}

type Clock = {
  now: () => number;
  timer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
  frame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
};

// Holding a portrait has no RAF callback. Stop cancels both the hold timer and
// transition frame, including when a menu preview covers the conversation.
export function createExplorerPlayback(clock: Clock, paint: (from: number, to: number, progress: number) => boolean, rest: (portrait: number) => void) {
  let timer: number | undefined;
  let frame: number | undefined;
  let running = false;
  let failed = false;
  let current = 0;
  let started = 0;
  let nextPaint = 0;
  let previous = 0;
  let missed = 0;
  const cancel = () => {
    if (timer !== undefined) clock.clearTimer(timer);
    if (frame !== undefined) clock.cancelFrame(frame);
    timer = frame = undefined;
  };
  const stop = () => { running = false; cancel(); rest(current); };
  const hold = () => {
    timer = clock.timer(() => {
      timer = undefined;
      if (!running) return;
      started = nextPaint = previous = clock.now();
      missed = 0;
      frame = clock.frame(tick);
    }, EXPLORER_HOLD_MS);
  };
  const tick = (time: number) => {
    frame = undefined;
    if (!running) return;
    missed = time - previous > 64 ? missed + 1 : 0;
    previous = time;
    if (missed >= 3) { failed = true; stop(); return; }
    if (time >= nextPaint) {
      const progress = Math.min(1, (time - started) / EXPLORER_TRANSITION_MS);
      if (!paint(current, 1 - current, progress)) { failed = true; stop(); return; }
      nextPaint += EXPLORER_FRAME_MS;
      if (nextPaint <= time) nextPaint = time + EXPLORER_FRAME_MS;
      if (progress >= 1) { current = 1 - current; rest(current); hold(); return; }
    }
    frame = clock.frame(tick);
  };
  return {
    start() { if (running || failed) return; running = true; rest(current); hold(); },
    stop,
  };
}

// Only the most recently visible scene animates. The rest stay painted once.
export function createExplorerMotionLease() {
  const scenes = new Map<symbol, (active: boolean) => void>();
  const update = () => { const keys = [...scenes.keys()]; const owner = keys[keys.length - 1]; for (const [key, notify] of scenes) notify(key === owner); };
  return {
    enter(key: symbol, notify: (active: boolean) => void) { scenes.set(key, notify); update(); },
    leave(key: symbol) { const notify = scenes.get(key); scenes.delete(key); notify?.(false); update(); },
  };
}
