import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = readFileSync(new URL("../src/components/ComposerMoreActions.tsx", import.meta.url), "utf8");
const module = { exports: {} as any };
const realRequire = createRequire(import.meta.url);
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  module, exports: module.exports, require: (id: string) => {
    if (id.endsWith(".css")) return {};
    if (id === "../lib/language") return { useI18n: () => ({ t: (key: string) => key }) };
    if (id === "./ComposerSvgIcon") return { ComposerSvgIcon: () => createElement("svg") };
    return realRequire(id);
  },
});
const props = { open: true, disabled: false, footprintEnabled: true, footprintBusy: false, onFile() {}, onFootprint() {} };
const render = (patch = {}) => renderToStaticMarkup(module.exports.ComposerMoreActions({ ...props, ...patch }));

test("more actions expose two choices and disable hidden controls", () => {
  assert.equal((render().match(/<button/g) ?? []).length, 2);
  assert.match(render(), /aria-hidden="false"/);
  const closed = render({ open: false });
  assert.match(closed, /aria-hidden="true"/);
  assert.equal((closed.match(/disabled=""/g) ?? []).length, 2);
  assert.equal((closed.match(/tabindex="-1"/g) ?? []).length, 2);
});

test("submission mode omits footprints and busy operations cannot be selected", () => {
  assert.equal((render({ footprintEnabled: false }).match(/<button/g) ?? []).length, 1);
  assert.equal((render({ disabled: true }).match(/disabled=""/g) ?? []).length, 2);
  assert.equal((render({ footprintBusy: true }).match(/disabled=""/g) ?? []).length, 1);
});

test("chat layouts share the same expansion and remove the old file/map popovers", () => {
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  assert.match(chat, /more=\{composerMoreActions\}/);
  assert.match(chat, /!mobileComposerLayout \? <ComposerActionsPopover/);
  assert.match(chat, /ComposerActionsPopover open=\{composerMoreOpen\}/);
  assert.match(chat, /setCompactComposerOverride\(!mobileComposerLayout\)/);
  assert.doesNotMatch(chat, /desktopComposerTool === "(?:file|footprint)"/);
  assert.doesNotMatch(chat, /mobileComposerPanel/);
  const css = readFileSync(new URL("../src/components/ComposerMoreActions.css", import.meta.url), "utf8");
  assert.match(css, /grid-template-rows:0fr/);
  assert.match(css, /grid-template-rows:1fr/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("layout switching is a peer action and footprints expose the current permission directly", () => {
  const expanded = render({ compact: false, onToggleLayout() {} });
  assert.equal((expanded.match(/<button/g) ?? []).length, 3);
  assert.match(expanded, /composer.collapseLayout/);
  assert.match(render({ compact: true, onToggleLayout() {} }), /composer.expandLayout/);
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  assert.match(chat, /authorized_by_me \? "composer.stopFootprintSharing" : "composer.publishFootprint"/);
  assert.doesNotMatch(chat, /chatTravelMapMenuOpen|composer-layout-toggle/);
  const load = chat.slice(chat.indexOf("const openComposerFootprintActions"), chat.indexOf("const grantChatTravelMap"));
  assert.match(load, /await api.getChatTravelMapAccess/);
  assert.match(load, /setComposerActionSheet\("footprint"\)/);
});

test("tablet back does not wait for a mobile-only animation and group counts stay on one line", () => {
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const close = chat.slice(chat.indexOf("const closeChatView ="), chat.indexOf("const closeChatView =") + 650);
  assert.match(close, /max-width: 719px/);
  assert.match(close, /prefers-reduced-motion: reduce/);
  assert.match(close, /navigate\(listPath\)/);
  assert.doesNotMatch(chat, /t\("chat.memberCount", \{ count: displayedChat.members \}\)/);
});

test("short screens default compact and expanded composer exposes a real line break", () => {
  const layout = readFileSync(new URL("../src/components/ChatComposerLayout.tsx", import.meta.url), "utf8");
  assert.match(layout, /max-height: 500px/);
  const input = readFileSync(new URL("../src/components/MentionComposerInput.tsx", import.meta.url), "utf8");
  assert.match(input, /insertLineBreak: \(\) => void/);
  assert.match(input, /range.insertNode\(br\)/);
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  assert.match(chat, /compactComposerOverride \?\? shortComposerLayout/);
  assert.match(chat, /mentionEditorRef.current\?\.insertLineBreak\(\)/);
});
