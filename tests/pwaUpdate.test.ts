import assert from "node:assert/strict";
import test from "node:test";
import { activatePwaUpdate, checkForPwaUpdate, CURRENT_RELEASE } from "../src/lib/pwaUpdate.ts";

const target = "2099.10.17.1";
function setup(context: { after: (fn: () => void) => void }, options: { oldEntry?: boolean; workerFailure?: boolean; waiting?: boolean; oldSite?: boolean; badAsset?: boolean } = {}) {
  const keys = ["window", "navigator", "DOMParser", "fetch", "sessionStorage"] as const;
  const originals = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  let restarts = 0;
  let changed: (() => void) | undefined;
  const worker = { postMessage: (message: { type: string }, ports?: MessagePort[]) => {
    if (message.type === "GET_RELEASE") ports?.[0].postMessage({ release: target });
    else changed?.();
  }};
  const values = {
    window: { setTimeout, clearTimeout, sessionStorage: { setItem() {} }, location: { origin: "https://sermo.jyonn.space", hostname: "sermo.jyonn.space", href: "https://sermo.jyonn.space/wzry/app/menu", replace() { restarts++; } } },
    navigator: { onLine: true, serviceWorker: { getRegistration: async () => ({ update: async () => { if (options.workerFailure) throw Error("network"); }, waiting: options.waiting ? worker : null, active: options.waiting ? null : worker }), addEventListener: (_: string, callback: () => void) => { changed = callback; }, removeEventListener() { changed = undefined; } } },
    DOMParser: class { parseFromString() { return { querySelector: () => ({ getAttribute: () => options.oldEntry ? CURRENT_RELEASE.id : target }), querySelectorAll: () => [{ getAttribute: () => "/assets/app.js" }] }; } },
    fetch: async (input: unknown) => String(input).includes("release.json") ? new Response(JSON.stringify({ ...CURRENT_RELEASE, id: options.oldSite ? CURRENT_RELEASE.id : target })) : new Response("resource", { headers: { "Content-Type": options.badAsset ? "text/html" : "text/javascript" } }),
    sessionStorage: { getItem: () => null, setItem() {} },
  };
  keys.forEach((key) => Object.defineProperty(globalThis, key, { configurable: true, value: values[key] }));
  context.after(() => keys.forEach((key, index) => { if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!); else Reflect.deleteProperty(globalThis, key); }));
  return () => restarts;
}

test("checks are single-flight and never restart the page", async (context) => {
  const restarts = setup(context);
  const first = checkForPwaUpdate();
  assert.equal(first, checkForPwaUpdate());
  assert.equal((await first).latestVersion, target);
  assert.equal(restarts(), 0);
});
for (const options of [{ oldEntry: true }, { workerFailure: true }, { oldSite: true }, { badAsset: true }]) {
  test(`failed readiness does not restart: ${JSON.stringify(options)}`, async (context) => {
    const restarts = setup(context, options);
    await assert.rejects(activatePwaUpdate());
    assert.equal(restarts(), 0);
  });
}
for (const waiting of [false, true]) {
  test(`verified ${waiting ? "waiting" : "active"} worker permits explicit restart`, async (context) => {
    const restarts = setup(context, { waiting });
    const phases: string[] = [];
    await activatePwaUpdate((phase) => phases.push(phase));
    assert.equal(restarts(), 1);
    assert.equal(phases.at(-1), "restarting");
  });
}
