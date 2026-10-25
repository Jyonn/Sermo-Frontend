import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
test('chat and menu share the full personal card preview', async () => {
  for (const page of ['ChatsPage', 'MenuPage']) {
    assert.match(await read(`pages/${page}.tsx`), /<MyProfileCardDrawer/);
  }
  const drawer = await read('components/MyProfileCardDrawer.tsx');
  assert.match(drawer, /previewAudience=\{audience\}/);
  assert.match(drawer, /profile\.friendView/);
  assert.match(drawer, /profile\.strangerView/);
});
test('self avatars default on without overriding explicit false or message selection', async () => {
  const chat = await read('pages/ChatsPage.tsx');
  assert.match(chat, /showSelfAvatar=\{currentUserMe\?\.show_self_avatar \?\? true\}/);
  assert.match(chat, /group\.from === "self" && groupAvatar && onOpenSelfProfile/);
  assert.match(chat, /prev\.onOpenSelfProfile === next\.onOpenSelfProfile/);
  assert.ok(chat.indexOf('selectionMode && groupAvatar') < chat.indexOf('group.from === "self" && groupAvatar && onOpenSelfProfile'));
});
