import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sheet headers reserve close space only when a close control exists', async () => {
  const source = await readFile(new URL('../src/components/BottomSheet.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/app/10-chat-city.css', import.meta.url), 'utf8');
  assert.match(source, /showCloseButton \? "has-close-button"/);
  assert.match(css, /\.bottom-sheet:not\(\.has-close-button\) \.sheet-header\s*\{\s*padding-right: 0/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
});
test('unread capsules use explicit font sizing and content-aware width', async () => {
  const css = await readFile(new URL('../src/components/UnreadIndicator.css', import.meta.url), 'utf8');
  assert.match(css, /font-size:10px/);
  assert.match(css, /width:max-content/);
  assert.doesNotMatch(css, /var\(--font-sans\)/);
});
