import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as entry from '../src/lib/spaceEntry.ts';

const require = createRequire(import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function render(slug?: string, disabled = false, language = 'zh-CN') {
  const copy = JSON.parse(read(`src/locales/${language}/translation.json`));
  const exports: Record<string, any> = {};
  vm.runInNewContext(ts.transpileModule(read('src/components/SpaceManagementLinks.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports,
    require(name: string) {
      if (name === '../lib/language') return { useI18n: () => ({ t: (key: string) => copy[key] ?? key }) };
      if (name === '../lib/spaceEntry') return entry;
      if (name.endsWith('.css')) return {};
      return require(name);
    },
  });
  return renderToStaticMarkup(React.createElement(exports.SpaceManagementLinks, { slug, disabled }));
}
test('public entry offers both explicit create and admin login routes', () => {
  const html = render();
  assert.match(html, /href="\/space\?mode=create"/);
  assert.match(html, /href="\/space\?mode=login"/);
  assert.match(html, /创建新空间/);
  assert.match(html, /空间管理员登录/);
  assert.doesNotMatch(html, /slug=/);
});
test('selected space only prefills admin login, never new-space creation', () => {
  const html = render(' WZRY ');
  assert.match(html, /href="\/space\?mode=create"/);
  assert.match(html, /href="\/space\?mode=login&amp;slug=wzry"/);
  assert.equal((html.match(/slug=/g) ?? []).length, 1);
});
test('busy login removes navigable links and English copy is present', () => {
  const html = render('wzry', true);
  assert.doesNotMatch(html, /href=/);
  assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 2);
  const english = render(undefined, false, 'en');
  assert.match(english, /Create a new space/);
  assert.match(english, /Space admin sign-in/);
});
test('homepage and PWA reuse the same links without introducing a second auth flow', () => {
  assert.match(read('src/pages/LandingPage.tsx'), /<SpaceManagementLinks \/>/);
  assert.match(read('src/pages/PwaAccountEntryPage.tsx'), /<SpaceManagementLinks slug=\{activeSpace\?\.slug\} disabled=\{launching \|\| loginBusy\}/);
});
