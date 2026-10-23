import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const copy = JSON.parse(fs.readFileSync(new URL('../src/locales/zh-CN/translation.json', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../src/pages/PwaAccountEntryPage.tsx', import.meta.url), 'utf8');
const account = (slug: string, id: number) => ({ key: `${slug}:${id}`, slug, spaceName: slug, session: { accessToken: 'fixture', refreshToken: 'fixture', user: { user_id: id, name: `User ${id}` } } });
const SharedLogin = () => null;

function harness(accounts = [account('solo', 1), account('multi', 2), account('multi', 3)]) {
  const states: any[] = []; let cursor = 0;
  const navigations: string[] = []; const activated: any[] = [];
  const exports: Record<string, any> = {};
  const normalizeSlug = (slug: string) => slug.trim().toLowerCase();
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URLSearchParams, Map, Date,
    window: { location: { search: '', assign: (url: string) => navigations.push(url), replace: (url: string) => navigations.push(url) } },
    require: (name: string) => {
      if (name === 'react') return { ...React, useEffect() {}, useMemo: (fn: () => unknown) => fn(), useState(initial: any) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; } };
      if (name === './JoinSpacePage') return { default: SharedLogin };
      if (name === '../lib/language') return { useI18n: () => ({ t: (key: string) => copy[key] || key }) };
      if (name === '../lib/pwaAccounts') return { listPwaCachedAccounts: () => accounts, activatePwaCachedAccount: (value: any) => activated.push(value), setDefaultPwaAccountKey() {} };
      if (name === '../lib/recentSpaces') return { listRecentSpaces: () => [], rememberRecentSpace() {} };
      if (name === '../lib/oauthPending') return { isOAuthLoginPending: () => false };
      if (name === '../lib/spaceEntry') return { normalizeSlug, buildJoinHrefForCurrentHost: (slug: string) => `/${slug}/`, buildSpaceHrefForCurrentHost: (slug: string, path: string, query: string) => `/${slug}${path}${query}` };
      if (name === '../components/UserAvatar') return { UserAvatar: () => null, SpaceAvatar: () => null };
      if (name === '../lib/api' || name.endsWith('.css')) return {};
      return require(name);
    },
  });
  const render = () => { cursor = 0; return exports.default(); };
  return { render, navigations, activated };
}

function elements(node: any): any[] {
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)];
}
const find = (tree: any, predicate: (node: any) => boolean) => { const node = elements(tree).find(predicate); assert.ok(node); return node; };
function selectOther(h: ReturnType<typeof harness>, slug: string) {
  find(h.render(), (n) => n.props.className === 'pwa-other-login-trigger').props.onClick();
  find(h.render(), (n) => n.type === 'input').props.onChange({ target: { value: slug } });
  find(h.render(), (n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
}

test('explicit other-account intent keeps even a single account visible and opens shared login', () => {
  const h = harness(); selectOther(h, ' SOLO ');
  const tree = h.render();
  assert.equal(h.navigations.length, 0);
  assert.equal(elements(tree).filter((n) => n.props.role === 'listitem').length, 1);
  const login = find(tree, (n) => n.type === SharedLogin);
  assert.equal(login.props.spaceSlug, 'solo'); assert.equal(login.props.embedded, true);
  assert.equal(elements(tree).filter((n) => n.type === 'input').length, 0);
  assert.equal(find(tree, (n) => n.props.className === 'pwa-other-login-trigger').props['aria-expanded'], true);
});
test('normal single-space shortcut remains fast, while multi-account selection stays in the chooser', () => {
  const h = harness();
  const buttons = elements(h.render()).filter((n) => n.props.role === 'listitem');
  buttons[1].props.onClick();
  assert.equal(h.activated[0].slug, 'solo');
  assert.equal(h.navigations[0], '/solo/app/chats?source=pwa');
  const multi = harness();
  elements(multi.render()).filter((n) => n.props.role === 'listitem')[0].props.onClick();
  assert.equal(multi.navigations.length, 0);
  assert.equal(elements(multi.render()).filter((n) => n.props.role === 'listitem').length, 2);
  assert.equal(find(multi.render(), (n) => n.props.className === 'pwa-other-login-trigger').props['aria-expanded'], false);
});
test('unknown space retains the normal join route and successful inline login activates the new account', () => {
  const h = harness(); selectOther(h, 'new-space');
  assert.equal(h.navigations[0], '/new-space/');
  const existing = harness(); selectOther(existing, 'solo');
  const login = find(existing.render(), (n) => n.type === SharedLogin);
  login.props.onBusyChange(true);
  find(existing.render(), (n) => n.type === SharedLogin).props.onJoined({ space: { slug: 'solo', name: 'Solo' }, auth: { auth: 'new', refresh: 'refresh', data: { user_id: 9, name: 'New account' } } });
  assert.equal(existing.activated[0].key, 'solo:9');
  assert.equal(existing.navigations[0], '/solo/app/chats?source=pwa');
});
test('embedded login shares password, new-user confirmation and recovery without cached-session redirection', () => {
  const join = fs.readFileSync(new URL('../src/pages/JoinSpacePage.tsx', import.meta.url), 'utf8');
  assert.match(join, /if \(embedded \|\| !session/);
  assert.match(join, /if \(onJoined\) \{ onJoined\(payload\); return; \}/);
  assert.match(join, /new_user_intent: newUserIntent/);
  assert.match(join, /USER@PASSWORD_REQUIRED/);
  assert.match(join, /USER@NEW_USER_CONFIRMATION_REQUIRED/);
  assert.match(join, /lookupPasswordRecovery/);
  assert.match(join, /onCompositionEnd/);
});
