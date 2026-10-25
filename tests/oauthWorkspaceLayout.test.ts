import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const read = (file: string) => readFile(new URL(`../src/components/${file}`, import.meta.url), 'utf8');

test('shared editor gates saving behind validated steps while preserving permission and approval controls', async () => {
  const editor = await read('OAuthApplicationEditor.tsx');
  const workspace = await read('OAuthApplicationWorkspace.tsx');
  assert.match(editor, /if \(step < oauthEditorSteps.length - 1\) onStep\(step \+ 1\);\s*else onCommit\(\)/);
  assert.match(editor, /required disabled=\{existing \|\| busy\}/);
  assert.match(editor, /data-step-focus required placeholder=/);
  assert.match(editor, /index > step/);
  assert.match(editor, /updateOAuthScopes\(draft.scopes, entry.scope, event.target.checked, scopeCatalog\)/);
  assert.match(editor, /step === 2 && !draft.scopes.length/);
  assert.match(workspace, /exceptionUris.length && !loopbackConfirmed/);
  assert.match(workspace, /approved_loopback_uris: loopbackConfirmed \? exceptionUris : \[\]/);
  assert.match(workspace, /kind: "discard"/);
  assert.match(workspace, /showSavedDraft \? \{ kind: "detail"/);
  assert.match(workspace, /if \(platform\) surface.addEventListener\("keydown", trap\)/);
  assert.doesNotMatch(workspace, /oauth-eyebrow|oauth-column-head/);
});

test('workspace adapts to its container and uses theme-aware state surfaces', async () => {
  const css = await read('OAuthApplicationWorkspace.css');
  const root = postcss.parse(css);
  const selectors = new Set<string>();
  root.walkRules(rule => {
    const key = `${rule.parent?.type === 'atrule' ? rule.parent.toString().split('{')[0] : ''}:${rule.selector}`;
    assert.ok(!selectors.has(key), `Duplicate rule ${key}`);
    selectors.add(key);
    if (/oauth-badge|oauth-error|oauth-confirm-icon/.test(rule.selector)) assert.ok(!/#(?:fff|edf5ee|fbefec|fbf2e2)\b/i.test(rule.toString()));
  });
  assert.match(css, /@container oauth-workspace/);
  assert.match(css, /@container oauth-panel/);
  assert.match(css, /\.oauth-panel-body \{ box-sizing:border-box;width:100%;/);
  assert.match(css, /\.oauth-editor-actions \{ position:sticky;bottom:0/);
  assert.match(css, /bottom:calc\(76px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /prefers-reduced-motion/);
});
