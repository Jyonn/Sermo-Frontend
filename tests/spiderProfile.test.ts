import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import postcss from "postcss";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/styles/app/61-spider-profile.css");
const root = postcss.parse(css);
test("spider cover artwork is shared by real cards, live previews and both catalog swatches", () => {
  let selectors = "";
  root.walkRules(rule => {
    if (rule.nodes.some(node => node.type === "decl" && node.value.includes("https://api.sermo.jyonn.space/resources/assets/85/display/37feb8b6669b64fc926ae6176b8b8546f72a1ca5e190857210f0a7cc42ac9fa1"))) selectors = rule.selector;
  });
  for (const selector of [".user-profile-panel.profile-theme-spider-city .user-profile-cover", ".profile-card-entry-swatch.theme-spider-city", ".profile-card-theme-option.theme-spider-city > span"]) assert.ok(selectors.includes(selector));
  const menu = read("src/pages/MenuPage.tsx");
  assert.match(menu, /user-profile-panel profile-card-preview-scale profile-theme-\$\{personalizationDraft.profile_card_theme\}/);
  assert.match(menu, /<UserProfileCard/);
  assert.match(read("src/components/UserProfilePanel.tsx"), /<UserProfileCard/);
});
test("spider palette covers dark mode without generic text recoloring or changing profile geometry", () => {
  assert.match(css, /html\[data-theme="dark"\] \.user-profile-panel\.profile-theme-spider-city/);
  for (const token of ["--profile-ink", "--profile-muted", "--profile-card", "--profile-action"]) assert.equal(css.split(`${token}:`).length - 1, 2);
  assert.doesNotMatch(css, /!important|:is\(p,small,span\)|min-height:|grid-template/);
  assert.doesNotMatch(read("src/styles/app/00-foundation.css"), /profile-theme-spider-city|spider-city-breathe/);
});
test("decorative artwork URLs remain immutable and centralized", () => {
  const mapping=JSON.parse(read("src/lib/activityAssetManifest.json"));
  for (const file of ["profile-web-cover.svg", "profile-silk.svg"]) {
    const uri=mapping[`/assets/activity/friendly-neighborhood/${file}`];
    assert.match(uri,/^https:\/\/api\.sermo\.jyonn\.space\/resources\/assets\/\d+\/display\/[a-f0-9]{64}$/);
    assert.ok(css.includes(uri));
  }
});
