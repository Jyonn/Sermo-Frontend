import test from 'node:test';
import assert from 'node:assert/strict';
import { applySiteTheme, resolveSiteTheme } from '../src/lib/siteTheme.ts';
import { managementSettingsForSection } from '../src/lib/managementNavigation.ts';

test('only explicit supported space themes can activate', () => {
  for (const value of [undefined, null, '', 'default', 'unknown', true]) assert.equal(resolveSiteTheme(value), 'default');
  assert.equal(resolveSiteTheme('qixi-2026'), 'qixi-2026');
  assert.equal(resolveSiteTheme('birthday-botanical'), 'birthday-botanical');
  assert.equal(resolveSiteTheme('christmas-2026'), 'christmas-2026');
});

test('switching space or signing out clears the previous skin', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const dataset: Record<string, string> = {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {documentElement: {dataset}} });
  try {
    applySiteTheme('qixi-2026');
    assert.equal(dataset.siteTheme, 'qixi-2026');
    applySiteTheme('default');
    assert.equal(dataset.siteTheme, undefined);
    applySiteTheme('qixi-2026');
    applySiteTheme(undefined);
    assert.equal(dataset.siteTheme, undefined);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('only the basics page can save the theme draft', () => {
  const saved = {qixi_theme_enabled: 0};
  const draft = {qixi_theme_enabled: 1};
  assert.equal(managementSettingsForSection('basics', saved, draft).qixi_theme_enabled, 1);
  assert.equal(managementSettingsForSection('features', saved, draft).qixi_theme_enabled, 0);
});
