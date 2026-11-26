import assert from "node:assert/strict";
import test from "node:test";
import { resolveStableResourceUri } from "../src/lib/stableResource.ts";
import { createThreadVoicePlayback } from "../src/lib/threadVoicePlayback.ts";

class TestAudio extends EventTarget {
  src = "";
  paused = true;
  ended = false;
  duration = 34;
  currentTime = 0;
  playCalls = 0;

  async play() {
    this.playCalls += 1;
    this.paused = false;
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  removeAttribute() { this.src = ""; }
  load() {}
}

function createPlayer() {
  const audio: TestAudio[] = [];
  const player = createThreadVoicePlayback({ makeAudio: () => {
    const element = new TestAudio();
    audio.push(element);
    return element as unknown as HTMLAudioElement;
  } });
  return { audio, player };
}

const first = { key: "first", uri: "https://example.test/first.wav" };
const second = { key: "second", uri: "https://example.test/second.wav" };

test("keeps playing after a bubble unsubscribes, and resumes at its current position", () => {
  const { audio, player } = createPlayer();
  const states: string[] = [];
  const unsubscribe = player.subscribe(first.key, () => states.push(player.getSnapshot(first.key).status));
  player.toggle(first);
  audio[0].dispatchEvent(new Event("playing"));
  unsubscribe();
  audio[0].currentTime = 8;
  audio[0].dispatchEvent(new Event("timeupdate"));
  assert.deepEqual(player.getSnapshot(first.key), { status: "playing", time: 8, duration: 34 });
  assert.deepEqual(states, ["loading", "playing"]);

  player.toggle(first);
  assert.equal(player.getSnapshot(first.key).status, "paused");
  player.toggle(first);
  audio[0].dispatchEvent(new Event("playing"));
  assert.equal(player.getSnapshot(first.key).time, 8);
  assert.equal(audio.length, 1);
  audio[0].dispatchEvent(new Event("ended"));
  assert.equal(player.getSnapshot(first.key).status, "idle");
});

test("switching tracks and leaving a thread release audio and ignore late events", () => {
  const { audio, player } = createPlayer();
  player.toggle(first);
  player.toggle(second);
  audio[0].dispatchEvent(new Event("playing"));
  audio[0].dispatchEvent(new Event("ended"));
  assert.equal(audio[0].paused, true);
  assert.equal(audio[0].src, "");
  assert.equal(player.getSnapshot(first.key).status, "idle");
  audio[1].dispatchEvent(new Event("playing"));
  assert.equal(player.getSnapshot(second.key).status, "playing");

  player.stop();
  assert.equal(audio[1].paused, true);
  assert.equal(audio[1].src, "");
  assert.equal(player.getSnapshot(second.key).status, "idle");
});

test("fails over once from a stale cached URI to the message URI", () => {
  const { audio, player } = createPlayer();
  const uri = "https://example.test/signed.wav?e=100&token=live";
  const cached = "https://example.test/signed.wav?e=200&token=stale";
  resolveStableResourceUri(cached);
  player.toggle({ key: "signed", uri });
  assert.equal(audio[0].src, cached);
  audio[0].dispatchEvent(new Event("error"));
  assert.equal(audio[0].src, uri);
  audio[0].dispatchEvent(new Event("error"));
  assert.equal(player.getSnapshot("signed").status, "idle");
  assert.equal(audio[0].playCalls, 2);
});
