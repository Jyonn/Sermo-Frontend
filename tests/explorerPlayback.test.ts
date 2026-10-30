import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerMotionLease, createExplorerPlayback, explorerMotionAllowed, explorerRasterBudget, EXPLORER_HOLD_MS, EXPLORER_TRANSITION_MS, EXPLORER_CANVAS_PIXELS, EXPLORER_CANVAS_SIDE } from "../src/lib/explorerPlayback.ts";

function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const frames = new Map<number, (time: number) => void>();
  return {
    now: () => now,
    timer(callback: () => void, delay: number) { const key = ++id; timers.set(key, { due: now + delay, callback }); return key; },
    clearTimer: (key: number) => { timers.delete(key); },
    frame(callback: (time: number) => void) { const key = ++id; frames.set(key, callback); return key; },
    cancelFrame: (key: number) => { frames.delete(key); },
    pending: () => ({ frames: frames.size, timers: timers.size }),
    advance(duration: number, cadence = 1000 / 60) {
      const end = now + duration;
      while (now < end - .00001) {
        now = Math.min(end, ...[...timers.values()].map((timer) => timer.due), frames.size ? now + cadence : Infinity);
        const pendingFrames = [...frames.values()]; frames.clear();
        for (const [key, timer] of timers) if (timer.due <= now) { timers.delete(key); timer.callback(); }
        for (const callback of pendingFrames) callback(now);
      }
    },
  };
}

test("portrait holds and hidden/stopped scenes perform zero animation frames", () => {
  const clock = fakeClock(); let paints = 0; const rests: number[] = [];
  const player = createExplorerPlayback(clock, () => { paints++; return true; }, (portrait) => rests.push(portrait));
  player.start(); player.start();
  clock.advance(EXPLORER_HOLD_MS - 1);
  assert.equal(paints, 0);
  assert.deepEqual(clock.pending(), { frames: 0, timers: 1 });
  clock.advance(1 + EXPLORER_TRANSITION_MS + 40);
  assert.ok(paints >= 50 && paints <= 63, `expected a capped transition, got ${paints}`);
  assert.equal(rests[rests.length - 1], 1);
  assert.deepEqual(clock.pending(), { frames: 0, timers: 1 });
  const completed = paints; player.stop();
  clock.advance(60_000);
  assert.equal(paints, completed);
  assert.deepEqual(clock.pending(), { frames: 0, timers: 0 });
});

test("stopping mid-transition cancels the pending frame and settles the portrait", () => {
  const clock = fakeClock(); let paints = 0;
  const player = createExplorerPlayback(clock, () => { paints++; return true; }, () => undefined);
  player.start(); clock.advance(EXPLORER_HOLD_MS + 400); player.stop();
  const stopped = paints; clock.advance(20_000);
  assert.ok(stopped > 0); assert.equal(paints, stopped);
  assert.deepEqual(clock.pending(), { frames: 0, timers: 0 });
});

test("over-budget rendering and persistent missed frames disable further animation", () => {
  for (const slow of [false, true]) {
    const clock = fakeClock(); let paints = 0;
    const player = createExplorerPlayback(clock, () => { paints++; return slow; }, () => undefined);
    player.start(); clock.advance(EXPLORER_HOLD_MS); clock.advance(1000, slow ? 80 : 1000 / 60);
    assert.deepEqual(clock.pending(), { frames: 0, timers: 0 });
    const stopped = paints; player.start(); clock.advance(30_000); assert.equal(paints, stopped);
  }
});

test("retina and desktop canvas backing stores stay within the fixed pixel budget", () => {
  for (const [width,height] of [[390,844],[1440,2560],[3840,2160],[1,1],[0,0]]) {
    const raster = explorerRasterBudget(width,height);
    assert.ok(raster.width <= EXPLORER_CANVAS_SIDE && raster.height <= EXPLORER_CANVAS_SIDE);
    assert.ok(raster.width * raster.height <= EXPLORER_CANVAS_PIXELS);
    assert.ok(raster.scale <= 1);
  }
  assert.equal(explorerMotionAllowed({ reduced: false, cores: 8, memory: 8 }), true);
  for (const device of [{ reduced: true }, { reduced: false, saveData: true }, { reduced: false, cores: 4 }, { reduced: false, memory: 4 }]) assert.equal(explorerMotionAllowed(device), false);
});

test("only the newest visible scene owns motion and the earlier scene resumes on close", () => {
  const lease = createExplorerMotionLease(); const a = Symbol(), b = Symbol();
  const states = new Map<symbol, boolean>();
  lease.enter(a, (active) => states.set(a, active)); assert.equal(states.get(a), true);
  lease.enter(b, (active) => states.set(b, active));
  assert.equal(states.get(a), false); assert.equal(states.get(b), true);
  lease.leave(b); assert.equal(states.get(a), true); assert.equal(states.get(b), false);
  lease.leave(a); assert.ok([...states.values()].every((active) => !active));
});
