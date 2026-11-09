import assert from "node:assert/strict";
import test from "node:test";
import { readPockloPickerMessage } from "../src/lib/pockloPicker.ts";

const frame = {} as Window;
const origin = "https://pocklo.jyonn.space";
const uuid = "b11d9988-d3ee-4e41-9a52-31cd0eb5765c";
const request = { version: 1, type: "pocklo.picker.request", requestId: uuid };
const read = (data: object, overrides: Partial<MessageEvent> = {}) =>
  readPockloPickerMessage({ source: frame, origin, data, ...overrides } as MessageEvent, frame);

test("accepts requests only from the mounted Pocklo frame and supported protocol", () => {
  const files = { ...request, action: "files", resourceId: "", query: "照片", offset: 100 };
  assert.deepEqual(read(files), { type: "files", requestId: uuid, resourceId: "", query: "照片", offset: 100 });
  assert.equal(read(files, { source: {} as Window }), null);
  assert.equal(read(files, { origin: origin + ".example" }), null);
  assert.equal(read({ ...files, version: 2 }), null);
  assert.equal(read({ ...files, resourceId: "../private" }), null);
  assert.equal(read({ ...files, offset: -1 }), null);
  assert.equal(read({ ...files, query: "x".repeat(257) }), null);
});

test("requires a resource and idempotency key for shares and validates the resulting URL", () => {
  const share = { ...request, action: "share", resourceId: "file", operationId: uuid };
  assert.deepEqual(read(share), { type: "share", requestId: uuid, resourceId: "file", operationId: uuid });
  assert.equal(read({ ...share, resourceId: "" }), null);
  assert.equal(read({ ...share, operationId: uuid + "\n" }), null);
  const url = origin + "/share/" + uuid;
  const selected = { type: "pocklo.picker.selected", version: 1, url };
  assert.deepEqual(read(selected), { type: "selected", url });
  assert.equal(read({ ...selected, url: url + "?secret=1" }), null);
  assert.equal(read({ ...selected, url: url.replace(origin, origin + ".example") }), null);
});
