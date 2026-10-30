import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exports: Record<string, any> = {};
vm.runInNewContext(ts.transpileModule(read('src/components/FeedbackState.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require });
const { FeedbackState } = exports;

test('shared feedback distinguishes errors, loading, empty content and contextual information', () => {
  for (const [tone, icon, role] of [['error', 'error', 'alert'], ['loading', 'progress_activity', 'status'], ['empty', 'inbox', 'status'], ['success', 'task_alt', 'status'], ['neutral', 'info', 'status']]) {
    const html = renderToStaticMarkup(React.createElement(FeedbackState, { tone, title: 'A title', description: 'Details' }));
    assert.ok(html.includes(`role="${role}"`));
    assert.ok(html.includes(`>${icon}</span>`));
    assert.equal(html.includes('aria-busy="true"'), tone === 'loading');
    assert.match(html, /aria-hidden="true"/);
  }
  const custom = renderToStaticMarkup(React.createElement(FeedbackState, { title: 'Verify', icon: 'verified_user' }));
  assert.match(custom, /verified_user/);
  assert.doesNotMatch(custom, />info</);
});

test('all informational dashed state surfaces are removed without removing functional upload boundaries', () => {
  const targets: Record<string, string[]> = {
    'src/styles/app/00-foundation.css': ['.feedback-state', '.feedback-state.error', '.feedback-state.success', '.feedback-state.loading'],
    'src/styles/app/10-chat-city.css': ['.empty-state'],
    'src/styles/app/20-profile-settings.css': ['.sticker-load-failed', '.travel-map-access-overview section > p'],
    'src/styles/permission-workspace.css': ['.permission-empty-rules'],
  };
  for (const [file, selectors] of Object.entries(targets)) {
    const root = postcss.parse(read(file));
    for (const selector of selectors) {
      let matched = false;
      root.walkRules(selector, (rule) => { matched = true; rule.walkDecls((decl) => assert.doesNotMatch(decl.value, /dashed|dotted/)); });
      assert.ok(matched, selector);
    }
  }
  assert.match(read('src/styles/app/20-profile-settings.css'), /\.composer-sticker-add\s*\{[^}]*dashed/s);
  assert.match(read('src/styles/app/60-profile-themes.css'), /\.composer-lab-add-photo[^}]*dashed/s);
});

test('quota error exposes a real retry callback, while loading never exposes a second request', () => {
  const source = ts.createSourceFile('SquarePage.tsx', read('src/pages/SquarePage.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = source.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === 'SquareQuotaPanel');
  assert.ok(node);
  const context: Record<string, any> = { exports: {}, require, FeedbackState, useI18n: () => ({ t: (key: string) => key }), useRef: () => ({ current: null }), useEffect() {} };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(node.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  let retries = 0;
  const failed = context.SquareQuotaPanel({ loading: false, quota: null, onRetry: () => retries++ });
  assert.equal(failed.type, FeedbackState);
  assert.equal(failed.props.tone, 'error');
  assert.equal(failed.props.icon, 'cloud_off');
  failed.props.action.props.onClick();
  assert.equal(retries, 1);
  const loading = context.SquareQuotaPanel({ loading: true, quota: null, onRetry: () => retries++ });
  assert.equal(loading.props.tone, 'loading');
  assert.equal(loading.props.action, undefined);
});

test('known unavailable and loading business states no longer fall back to neutral info', () => {
  assert.match(read('src/components/UserProfilePanel.tsx'), /<FeedbackState tone="error" title=\{t\("profile.unavailable"\)/);
  assert.match(read('src/components/ResearchChat.tsx'), /submissionInviteDetailLoading \? <FeedbackState tone="loading"/);
  assert.match(read('src/pages/SpaceAdminDashboardPage.tsx'), /activitiesState === "error" \? <FeedbackState tone="error"/);
});
