import assert from "node:assert/strict";
import test from "node:test";
import { chronelleOrigin } from "../src/lib/chronelleOrigin.ts";

test("both Frienden mirrors use Chronelle's mirror; canonical sites stay unchanged", () => {
  for (const host of ["sermo.6-79.cn", "frienden.6-79.cn"]) assert.equal(chronelleOrigin(host), "https://chronelle.6-79.cn");
  for (const host of ["sermo.jyonn.space", "frienden.jyonn.space", "localhost", "frienden.6-79.cn.evil.test"]) assert.equal(chronelleOrigin(host), "https://chronelle.jyonn.space");
});
