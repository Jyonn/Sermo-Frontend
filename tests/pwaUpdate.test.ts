import assert from "node:assert/strict";
import test from "node:test";
import {
  activatePwaUpdate,
  checkForPwaUpdate,
  CURRENT_RELEASE,
  getPwaUpdateCheckSnapshot,
  subscribePwaUpdateCheck,
} from "../src/lib/pwaUpdate.ts";

test("automatic and manual checks share one release query and result", async (context) => {
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  context.after(() => {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: unknown }).window;
  });

  const versions = CURRENT_RELEASE.id.split(".");
  versions[3] = String(Number(versions[3]) + 1);
  const newerRelease = { ...CURRENT_RELEASE, id: versions.join(".") };
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    const release = String(input).includes("6-79.cn") ? newerRelease : CURRENT_RELEASE;
    return new Response(JSON.stringify(release), { status: 200 });
  };

  const checking: boolean[] = [];
  const unsubscribe = subscribePwaUpdateCheck(() => checking.push(getPwaUpdateCheckSnapshot().checking));
  const automatic = checkForPwaUpdate();
  const manual = checkForPwaUpdate();
  assert.equal(automatic, manual);
  const result = await automatic;
  unsubscribe();

  assert.equal(requested.length, 2);
  assert.ok(requested.every((url) => url.includes("/release.json?t=")));
  assert.deepEqual(checking, [true, false]);
  assert.equal(result.latestVersion, newerRelease.id);
  assert.equal(result.updateAvailable, true);
  assert.equal(getPwaUpdateCheckSnapshot().result, result);

  globalThis.fetch = async (input) => {
    if (String(input).includes("6-79.cn")) throw new Error("offline");
    return new Response(JSON.stringify(CURRENT_RELEASE), { status: 200 });
  };
  const partial = await checkForPwaUpdate();
  assert.deepEqual(partial.sources.map((source) => source.status), ["ok", "error"]);
  assert.equal(partial.updateAvailable, false);
});

test("the page reloads only after an explicit update action", async (context) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let reloads = 0;
  let reason = "";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: { setItem: (_key: string, value: string) => { reason = value; } },
      location: { reload: () => { reloads += 1; } },
    },
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  context.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  assert.equal(reloads, 0);
  await activatePwaUpdate();
  assert.equal(reloads, 1);
  assert.equal(reason, "user-requested-pwa-update");
});
