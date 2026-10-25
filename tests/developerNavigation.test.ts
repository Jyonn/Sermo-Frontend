import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('developer management has a guarded top-level route instead of a menu drawer', async () => {
  const read = (path: string) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const nav = await read('components/AppBottomNav.tsx');
  const menu = await read('pages/MenuPage.tsx');
  const page = await read('pages/DeveloperPage.tsx');
  const app = await read('App.tsx');
  assert.match(nav, /key: "developer", href: "\/app\/developer"/);
  assert.match(nav, /route.key === "developer"\) return canManageOAuthApplications/);
  assert.match(app, /<RequireAuth><DeveloperPage \/><\/RequireAuth>/);
  assert.match(page, /api.getSpaceMe\(controller.signal\)/);
  assert.match(page, /!canManageOAuthApplications\(current.space, spaceId\)/);
  assert.match(page, /<OAuthApplicationWorkspace key=\{spaceId\}/);
  assert.doesNotMatch(menu, /<OAuthApplicationWorkspace|historyKey="oauth-applications"/);
  assert.match(menu, /navigate\("\/app\/developer", \{ replace: true \}\)/);
});
