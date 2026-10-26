import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/styles/app/20-profile-settings.css', import.meta.url), 'utf8');
test('friend QR surfaces follow theme while code retains a white scanning area', () => {
  const rule = (name: string) => css.match(new RegExp(`\\.${name} \\{([^}]+)\\}`))?.[1] ?? '';
  assert.match(rule('menu-share-card'), /var\(--bg-elevated\)/);
  assert.match(rule('menu-share-card'), /min\(100%, 440px\)/);
  assert.match(rule('menu-share-link-box'), /var\(--bg-canvas\)/);
  assert.match(rule('menu-share-qr-frame'), /background: #fff/);
  assert.match(rule('menu-share-qr-image'), /border-radius: 0/);
});
