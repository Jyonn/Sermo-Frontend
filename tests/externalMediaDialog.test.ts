import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('external media opens its input dialog without requesting clipboard access', () => {
  const source = read('src/pages/SquarePage.tsx');
  assert.doesNotMatch(source, /navigator\.clipboard\??\.readText/);
  assert.match(source, /setContentSheetOpen\(false\); setExternalMediaDialogOpen\(true\);/);
  assert.match(source, /open=\{externalMediaDialogOpen\}/);
});

test('external media hint is concise in Chinese and English', () => {
  assert.equal(JSON.parse(read('src/locales/zh-CN/translation.json'))['square.externalMediaHint'], '网易云、Apple Music等');
  assert.equal(JSON.parse(read('src/locales/en/translation.json'))['square.externalMediaHint'], 'NetEase, Apple Music, and more');
});
