import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (file: string) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('entrance settings save each change without a separate save action', () => {
  const text = source('components/BgmEntranceSettings.tsx');
  assert.doesNotMatch(text, /common.save|settingsSaved/);
  assert.match(text, /save\(\{ mode: value \}\)/);
  assert.match(text, /save\(\{ track: value \}\)/);
  assert.match(text, /save\(\{ receive_audio: value \}\)/);
  assert.match(text, /saving.current/);
  assert.match(text, /catch \(error\).*throw error/);
  assert.ok(text.indexOf('await api.configureBgm') < text.indexOf('setMode(result'));
  assert.match(text, /onUpdate\(result\);\s+if \(alive.current\)/);
});

test('key settings use their own drawer and a matching entry below the profile card', () => {
  const text = source('pages/MenuPage.tsx');
  assert.match(text, /<SideDrawer historyKey="bgm-settings"/);
  const entry = text.indexOf('personalization-entry-preview bgm-key-entry-preview');
  assert.ok(entry > text.indexOf('personalization-feature-entry profile-card-entry'));
  assert.match(text.slice(entry - 230, entry), /personalization-background-entry personalization-feature-entry/);
});
