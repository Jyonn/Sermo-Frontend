import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerMotionLease, createExplorerPlayback, explorerMotionAllowed, EXPLORER_FIRST_HOLD_MS, EXPLORER_HOLD_MS, EXPLORER_TRANSITION_MS } from "../src/lib/explorerPlayback.ts";

function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  return {
    timer(callback: () => void, delay: number) { const key = ++id; timers.set(key, { due: now + delay, callback }); return key; },
    clearTimer: (key: number) => { timers.delete(key); },
    pending: () => timers.size,
    advance(duration: number) {
      const end = now + duration;
      while (timers.size) {
        const [key, next] = [...timers].sort((a,b) => a[1].due-b[1].due)[0];
        if (next.due > end) break;
        now = next.due; timers.delete(key); next.callback();
      }
      now = end;
    },
  };
}

test("the first flash starts promptly and each hold schedules only one timer", () => {
  const clock = fakeClock(); const changes: number[][] = []; const rests: number[] = [];
  const player = createExplorerPlayback(clock, (from,to) => { changes.push([from,to]); return () => undefined; }, (portrait) => rests.push(portrait));
  player.start(); player.start();
  clock.advance(EXPLORER_FIRST_HOLD_MS - 1);
  assert.equal(changes.length, 0); assert.equal(clock.pending(), 1);
  clock.advance(1); assert.deepEqual(changes, [[0,1]]);
  clock.advance(EXPLORER_TRANSITION_MS);
  assert.equal(rests.at(-1), 1); assert.equal(clock.pending(), 1);
  clock.advance(EXPLORER_HOLD_MS - 1); assert.equal(changes.length, 1);
  clock.advance(1); assert.deepEqual(changes, [[0,1],[1,0]]);
  player.stop(); assert.equal(clock.pending(), 0);
});

test("hiding mid-flash cancels its animation and timer and restores the settled identity", () => {
  const clock = fakeClock(); let cancelled = 0, transitions = 0; let portrait = -1;
  const player = createExplorerPlayback(clock, () => { transitions++; return () => { cancelled++; }; }, (value) => { portrait = value; });
  player.start(); clock.advance(EXPLORER_FIRST_HOLD_MS + 400); player.stop();
  assert.equal(cancelled, 1); assert.equal(portrait, 0); assert.equal(clock.pending(), 0);
  clock.advance(60_000); assert.equal(transitions, 1);
  player.start(); clock.advance(EXPLORER_HOLD_MS + EXPLORER_TRANSITION_MS);
  assert.equal(portrait, 1); assert.equal(cancelled, 2);
  player.stop();
});

test("unsupported animation settles safely and cannot create a repeated error loop", () => {
  const clock = fakeClock(); let attempts = 0;
  const player = createExplorerPlayback(clock, () => { attempts++; throw Error("unavailable"); }, () => undefined);
  player.start(); clock.advance(EXPLORER_FIRST_HOLD_MS);
  player.start(); clock.advance(60_000);
  assert.equal(attempts, 1); assert.equal(clock.pending(), 0);
});

test("entry-level phones retain the lightweight flash, explicit motion and data preferences win", () => {
  assert.equal(explorerMotionAllowed({ reduced: false, cores: 4, memory: 2 }), true);
  assert.equal(explorerMotionAllowed({ reduced: false, cores: 2, memory: 1 }), true);
  assert.equal(explorerMotionAllowed({ reduced: false, cores: 8, memory: 8 }), true);
  assert.equal(explorerMotionAllowed({ reduced: true }), false);
  assert.equal(explorerMotionAllowed({ reduced: false, saveData: true }), false);
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
