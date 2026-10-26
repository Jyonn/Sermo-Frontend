import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("duel numerals use a bundled compact font with numeric OpenType features", () => {
  const font = readFileSync(new URL("../public/fonts/frienden-duel-digits-v1.woff2", import.meta.url));
  assert.equal(font.subarray(0, 4).toString(), "wOF2");
  assert.ok(font.length < 16_384);
  const css = readFileSync(new URL("../src/components/NumberDuelDigits.css", import.meta.url), "utf8");
  for (const selector of [".duel-timer", ".duel-digit-input", ".duel-result-points", ".duel-history-row strong", ".duel-card-code b"]) assert.ok(css.includes(selector));
  assert.match(css, /tabular-nums lining-nums slashed-zero/);
  assert.match(css, /font-display:swap/);
  assert.ok(readFileSync(new URL("../public/fonts/space-grotesk-OFL.txt", import.meta.url), "utf8").includes("SIL OPEN FONT LICENSE"));
});
