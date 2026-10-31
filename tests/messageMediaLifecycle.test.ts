import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as media from "../src/lib/messageMedia.ts";
import * as stable from "../src/lib/stableResource.ts";
import { preserveStableMediaUri } from "../src/lib/chatMessageReconciliation.ts";
import type { ChatMessage } from "../src/types.ts";

test("upload acknowledgement retains local geometry and a reversible source fallback", () => {
  const pending = { clientId: "local", kind: "image", localPreviewUri: "blob:upload", payload: { kind: "image", uri: "blob:upload", pixel_width: 1200, pixel_height: 1800 } } as ChatMessage;
  const remote = "https://media.test/messages/blob/lifecycle";
  const result = preserveStableMediaUri(pending, { ...pending, localPreviewUri: undefined, payload: { kind: "image", uri: remote } });
  assert.equal(result.payload?.pixel_width, 1200);
  assert.equal(result.payload?.pixel_height, 1800);
  assert.deepEqual(media.mediaSourceCandidates(remote), { primary: "blob:upload", fallback: remote });
  assert.deepEqual(media.mediaSourceCandidates("blob:upload"), { primary: "blob:upload", fallback: remote });
  assert.equal(media.mediaSourceCandidates(`${remote}?variant=playback`).primary, `${remote}?variant=playback`);
  media.releaseLocalMedia("blob:upload");
  assert.equal(media.mediaSourceCandidates(remote).primary, remote);
});

test("image and video thumbnails share predictable ratio limits and refreshed signatures", () => {
  assert.equal(media.messageMediaAspect(1920, 1080), 16 / 9);
  assert.equal(media.messageMediaAspect(1080, 1920), 9 / 16);
  assert.equal(media.messageMediaAspect(100, 10000), 9 / 16);
  assert.equal(media.messageMediaAspect(10000, 100), 16 / 9);
  assert.equal(media.messageMediaAspect(0, NaN), 4 / 3);
  const old = "https://media.test/messages/blob/token?e=1&token=old";
  const fresh = "https://media.test/messages/blob/token?e=100&token=new";
  stable.resolveStableResourceUri(old);
  assert.equal(stable.resolveStableResourceUri(fresh), fresh);
  assert.equal(stable.resolveStableResourceUri(old), fresh);
  assert.equal(stable.preferFreshResourceUri(fresh, "https://media.test/messages/blob/token"), "https://media.test/messages/blob/token");
  assert.equal(media.freshMediaUri("blob:local", 2, "test"), "blob:local");
  assert.equal(media.freshMediaUri("https://cdn.test/file?token=signed", 2, "test"), "https://cdn.test/file?token=signed");
});

test("automatic recovery keeps retry URLs stable, bypasses bad cache and cancels stale work", () => {
  const cells: any[] = []; let cursor = 0; let effect: (() => () => void) | undefined; let cleanup: (() => void) | undefined;
  const timers = new Map<number, () => void>(); let serial = 0;
  const exports: Record<string, any> = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/useMediaSource.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Date, window: { setTimeout(fn: () => void) { const id = ++serial; timers.set(id, fn); return id; }, clearTimeout(id: number) { timers.delete(id); } },
    require(name: string) {
      if (name === "./messageMedia") return media;
      if (name === "./stableResource") return stable;
      if (name === "react") return { useEffect(fn: () => () => void) { effect = fn; }, useRef(initial: any) { const i = cursor++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i]; }, useState(initial: any) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], (next: any) => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }]; } };
      throw new Error(name);
    },
  });
  const render = (uri: string) => { cursor = 0; return exports.useMediaSource(uri); };
  const uri = "https://media.test/messages/blob/recover?variant=playback";
  render(uri); cleanup = effect?.();
  assert.equal(render(uri).phase, "loading");
  render(uri).fail();
  assert.equal(render(uri).phase, "loading", "a temporary error must not immediately show a failure");
  timers.values().next().value!(); timers.clear();
  const retry = render(uri).src;
  assert.match(retry, /variant=playback&sermo_retry=/);
  assert.equal(render(uri).src, retry, "rerenders must not restart the same retry URL");
  render(uri).ready(); assert.equal(render(uri).phase, "idle");
  render(uri).fail(); assert.equal(timers.size, 1);
  cleanup?.(); render("https://media.test/messages/blob/next"); cleanup = effect?.();
  assert.equal(timers.size, 0);
  assert.equal(render("https://media.test/messages/blob/next").phase, "loading");
  cleanup?.();
});

test("cached videos support suffix and open-ended byte ranges", async () => {
  const context = vm.createContext({ self: { location: { origin: "https://app.test" }, addEventListener() {} }, importScripts() {}, Request, Response, Headers, URL, Blob, Set, console });
  vm.runInContext(fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  const range = vm.runInContext("rangedMediaResponse", context);
  const cached = () => new Response("0123456789", { headers: { "Content-Type": "video/mp4" } });
  const suffix = await range(cached(), "bytes=-3");
  assert.equal(await suffix.text(), "789"); assert.equal(suffix.headers.get("Content-Range"), "bytes 7-9/10");
  assert.equal(await (await range(cached(), "bytes=7-")).text(), "789");
  assert.equal((await range(cached(), "bytes=50-")).status, 416);
});

test("media retries delete the cached variant and force a network reload", async () => {
  let deleted = false; let network = 0; let mode = "";
  const cache = { async delete() { deleted = true; }, async match() { return new Response("bad old bytes"); } };
  const context = vm.createContext({ self: { location: { origin: "https://app.test" }, addEventListener() {} }, importScripts() {}, Request, Response, Headers, URL, Blob, Set, console,
    caches: { open: async () => cache }, fetch: async (request: Request) => { network++; mode = request.cache; return new Response("fresh bytes"); },
  });
  vm.runInContext(fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  vm.runInContext("persistMediaResponse = async () => {};", context);
  const handle = vm.runInContext("handleMediaRequest", context);
  const result = await handle(new Request("https://app.test/messages/blob/a?variant=playback&sermo_retry=1"), { slug: "a", variant: "original-playback" });
  assert.equal(await result.response.text(), "fresh bytes");
  assert.equal(deleted, true); assert.equal(network, 1); assert.equal(mode, "reload");
});
