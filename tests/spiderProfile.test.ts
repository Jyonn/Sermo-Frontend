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
    if (rule.nodes.some(node => node.type === "decl" && node.value.includes("profile-web-cover.svg"))) selectors = rule.selector;
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
test("web artworks are small self-contained decorative SVGs, with no remote requests or text", () => {
  for (const file of ["profile-web-cover.svg", "profile-silk.svg"]) {
    const svg = read(`src/assets/activity/friendly-neighborhood/${file}`);
    assert.match(svg, /viewBox=/);
    assert.doesNotMatch(svg, /<text|<script|<image|href=|filter=/);
    assert.ok(Buffer.byteLength(svg) < 6000);
  }
});
