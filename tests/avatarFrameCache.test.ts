import test from 'node:test';
import assert from 'node:assert/strict';

test('frame settings survive reload, isolate users, and accept removal without depending on avatar URLs', async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }});
  const cache = await import('../src/lib/avatarFrameCache.ts');
  let notifications = 0;
  const unsubscribe = cache.subscribeAvatarFrames(() => { notifications++; });
  const users = [{ user_id: 1, avatar_uri: 'shared.png', avatar_frame_style: 'explorer-conan' }, { user_id: 2, avatar_uri: 'shared.png', avatar_frame_style: 'spider-web' }];
  assert.equal(cache.rememberAvatarFrames({ members: users }).members, users);
  assert.equal(cache.cachedAvatarFrame(1), 'explorer-conan');
  assert.equal(cache.cachedAvatarFrame(2), 'spider-web');
  cache.rememberAvatarFrames({ user_id: 1, avatar_uri: 'replacement.png' });
  assert.equal(cache.cachedAvatarFrame(1), 'explorer-conan');
  cache.rememberAvatarFrames({ user_id: 1, avatar_frame_style: 'none' });
  assert.equal(cache.cachedAvatarFrame(1), 'none');
  assert.equal(notifications, 2);
  await Promise.resolve();
  const reloaded = await import('../src/lib/avatarFrameCache.ts?reload');
  assert.equal(reloaded.cachedAvatarFrame(1), 'none');
  assert.equal(reloaded.cachedAvatarFrame(2), 'spider-web');
  unsubscribe();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  const blocked = await import('../src/lib/avatarFrameCache.ts?blocked');
  assert.doesNotThrow(() => blocked.rememberAvatarFrames({ user_id: 3, avatar_frame_style: 'orbit' }));
  await Promise.resolve();
  assert.equal(blocked.cachedAvatarFrame(3), 'orbit');
});
