import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('drawer conversation picker receives remaining height rather than an intrinsic grid track', () => {
  const css = read('src/styles/app/00-foundation.css');
  assert.match(css, /\.chat-target-picker-drawer > \.drawer-body\s*\{[^}]*display: flex;[^}]*min-height: 0;/);
  assert.match(css, /\.chat-target-picker-drawer \.chat-target-picker-body\s*\{[^}]*flex: 1 1 0;[^}]*height: auto;/);
});

test('picker submit footer inherits its surrounding surface', () => {
  assert.match(read('src/components/ChatTargetPicker.css'), /\.chat-target-picker-body > \.chat-target-picker-submit\s*\{[^}]*background:transparent;/);
});

test('short landscape drawers share the sheet two-column layout', () => {
  const css = read('src/components/ChatTargetPicker.css');
  assert.match(css, /:is\(\.chat-target-picker-sheet,\.chat-target-picker-drawer \.drawer-body\)/);
  assert.match(css, /\.chat-target-picker-drawer \.forward-route-switch \{ grid-template-columns:minmax\(0,1fr\); \}/);
});
