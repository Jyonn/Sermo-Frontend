export const EXPLORER_FIRST_HOLD_MS = 3_000;
export const EXPLORER_HOLD_MS = 8_000;
export const EXPLORER_TRANSITION_MS = 1_000;

export function explorerMotionAllowed(device: { reduced: boolean; saveData?: boolean; cores?: number; memory?: number }) {
  // The compositor-only flash also runs on entry-level phones. Respect explicit
  // accessibility/data preferences rather than guessing from CPU/RAM counts.
  return !device.reduced && !device.saveData;
}

type Clock = {
  timer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
};

// One timer while holding, one while transitioning. The browser animates the
// small portrait layers; there is no JavaScript frame loop or canvas renderer.
export function createExplorerPlayback(clock: Clock, transition: (from: number, to: number) => () => void, rest: (portrait: number) => void) {
  let timer: number | undefined;
  let cancelTransition: (() => void) | undefined;
  let running = false;
  let failed = false;
  let first = true;
  let current = 0;
  const stop = () => {
    running = false;
    if (timer !== undefined) clock.clearTimer(timer);
    timer = undefined;
    rest(current);
    cancelTransition?.();
    cancelTransition = undefined;
  };
  const hold = (delay: number) => {
    timer = clock.timer(() => {
      timer = undefined;
      if (!running) return;
      const next = 1 - current;
      try { cancelTransition = transition(current, next); }
      catch { failed = true; stop(); return; }
      timer = clock.timer(() => {
        timer = undefined;
        if (!running) return;
        current = next;
        rest(current);
        cancelTransition?.();
        cancelTransition = undefined;
        hold(EXPLORER_HOLD_MS);
      }, EXPLORER_TRANSITION_MS);
    }, delay);
  };
  return {
    start() {
      if (running || failed) return;
      running = true;
      rest(current);
      hold(first ? EXPLORER_FIRST_HOLD_MS : EXPLORER_HOLD_MS);
      first = false;
    },
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
