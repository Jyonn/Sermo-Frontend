import assert from "node:assert/strict";
import test from "node:test";
import { POCKLO_ORIGIN, pockloPickerMessage } from "../src/lib/pockloPicker.ts";

const frame = {} as Window;
const url = POCKLO_ORIGIN + "/share/b11d9988-d3ee-4e41-9a52-31cd0eb5765c";
const message = (data: unknown, event: Partial<MessageEvent> = {}) => ({
  source: frame, origin: POCKLO_ORIGIN, data, ...event,
} as MessageEvent);

test("accepts picker events only from the mounted Pocklo frame using protocol v1", () => {
  const ready = { version: 1, type: "pocklo.picker.ready" };
  assert.deepEqual(pockloPickerMessage(message(ready), frame), { type: "ready" });
  assert.equal(pockloPickerMessage(message(ready), null), null);
  assert.equal(pockloPickerMessage(message(ready, { source: {} as Window }), frame), null);
  assert.equal(pockloPickerMessage(message(ready, { origin: "https://evil.example" }), frame), null);
  assert.equal(pockloPickerMessage(message({ ...ready, version: 2 }), frame), null);
});

test("only canonical Pocklo share URLs can enter the composer", () => {
  const selected = { version: 1, type: "pocklo.picker.selected" };
  assert.deepEqual(pockloPickerMessage(message({ ...selected, url }), frame), { type: "selected", url });
  for (const invalid of [url + "?secret=1", url + "#fragment", url + "\n",
    url.replace("pocklo.jyonn.space", "pocklo.jyonn.space.evil.example"), POCKLO_ORIGIN + "/share/not-a-token"]) {
    assert.equal(pockloPickerMessage(message({ ...selected, url: invalid }), frame), null);
  }
  assert.deepEqual(pockloPickerMessage(message({ version: 1, type: "pocklo.picker.cancelled" }), frame), { type: "cancelled" });
  assert.deepEqual(pockloPickerMessage(message({ version: 1, type: "pocklo.picker.error", code: "popup_blocked" }), frame), { type: "blocked" });
});
