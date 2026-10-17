import assert from "node:assert/strict";
import test from "node:test";
import { detailMotionGeometry, animateSquareDetail, prepareDetailImages } from "../src/lib/squareDetailMotion.ts";

test("shared card geometry keeps the first frame at the original card bounds", () => {
  const plan = detailMotionGeometry({ left: 0, top: 140, width: 390, height: 450 }, { left: 0, top: 58, width: 390, height: 450 }, { width: 390, height: 844 });
  assert.equal(plan.transform, "translate(0px, 82px) scale(1)");
  assert.equal(plan.clipPath, "inset(140px 0px 254px 0px round 12px)");
});
test("partially visible cards never create negative clipping insets", () => {
  const plan = detailMotionGeometry({ left: -2, top: -120, width: 394, height: 1100 }, { left: 0, top: 58, width: 390, height: 1100 }, { width: 390, height: 844 });
  assert.equal(plan.clipPath, "inset(0px 0px 0px 0px round 12px)");
  assert.doesNotMatch(plan.transform, /NaN|Infinity/);
});
test("all layers use one clock, reverse continuously and honor reduced motion", async () => {
  const calls: Array<{ frames: Keyframe[]; options: KeyframeAnimationOptions; animation: { startTime: number | null; finished: Promise<void>; cancel: () => void } }> = [];
  let reduced = false;
  const mock = (extra = {}) => ({
    ...extra,
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { startTime: null as number | null, finished: Promise.resolve(), cancel() {} };
      calls.push({ frames, options, animation });
      return animation;
    },
  });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: reduced }) } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { timeline: { currentTime: 100 } } });
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: () => ({ opacity: "0.6", transform: "matrix(1, 0, 0, 1, 0, 42)", clipPath: "inset(60px 0px 100px 0px)" }) });
  try {
    const nodes = { surface: mock({ getBoundingClientRect: () => ({ left: 0, top: 0 }), scrollTop: 0 }), card: mock({ offsetLeft: 0, offsetTop: 58, offsetWidth: 390, offsetHeight: 450 }), header: mock(), discussion: mock(), dock: mock(), mask: mock() } as unknown as Parameters<typeof animateSquareDetail>[0];
    const origin = { left: 0, top: 140, width: 390, height: 450 };
    await animateSquareDetail(nodes, origin).finished;
    assert.equal(calls.length, 6);
    assert.ok(calls.every(({ animation, options }) => animation.startTime === 100 && options.duration === 460));
    assert.ok(calls.every(({ frames }) => frames.every((frame) => !("width" in frame) && !("height" in frame))));
    calls.length = 0;
    await animateSquareDetail(nodes, origin, true, true).finished;
    assert.equal(calls[1].frames[0].transform, "matrix(1, 0, 0, 1, 0, 42)");
    assert.equal(calls[1].frames[1].transform, "translate(0px, 82px) scale(1)");
    calls.length = 0;
    reduced = true;
    await animateSquareDetail(nodes, origin).finished;
    assert.ok(calls.every(({ options }) => options.duration === 0));
  } finally {
    for (const [key, descriptor] of [["window", originalWindow], ["document", originalDocument], ["getComputedStyle", originalStyle]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
test("image preparation tolerates failed decoding and can be cancelled", async () => {
  const surface = { querySelectorAll: () => [{ decode: () => Promise.reject(new Error("unavailable")) }] } as unknown as HTMLElement;
  await prepareDetailImages(surface, new AbortController().signal);
  const controller = new AbortController();
  const stalled = { querySelectorAll: () => [{ decode: () => new Promise(() => {}) }] } as unknown as HTMLElement;
  const pending = prepareDetailImages(stalled, controller.signal);
  controller.abort();
  await pending;
});
