import assert from 'node:assert/strict';
import test from 'node:test';
import {ShareResourceCache} from '../src/lib/shareResourceCache.ts';

test('simultaneous and later readers share metadata until its original deadline', async () => {
  let now = 0, fetches = 0;
  const cache = new ShareResourceCache<string>(4, () => now);
  const fetchMetadata = async () => ({value: `metadata-${++fetches}`, validUntil: now + 60});
  assert.deepEqual(await Promise.all([cache.load('share', fetchMetadata), cache.load('share', fetchMetadata)]),
    ['metadata-1', 'metadata-1']);
  now = 59;
  assert.equal(await cache.load('share', fetchMetadata), 'metadata-1');
  now = 60;
  assert.equal(await cache.load('share', fetchMetadata), 'metadata-2');
});

test('a forced refresh updates cached metadata and keeps account keys independent', async () => {
  const cache = new ShareResourceCache<string>();
  const read = (value: string) => async () => ({value, validUntil: Infinity});
  await cache.load('account-a:share', read('original'));
  await cache.load('account-b:share', read('other'));
  await cache.load('account-a:share', read('updated'), true);
  assert.equal(cache.get('account-a:share'), 'updated');
  assert.equal(cache.get('account-b:share'), 'other');
});

test('invalidating a share prevents an in-flight response from restoring it', async () => {
  const cache = new ShareResourceCache<string>();
  let finish: (value: {value: string; validUntil: number}) => void = () => {};
  const request = cache.load('share', () => new Promise(resolve => {finish = resolve;}));
  await Promise.resolve();
  cache.invalidate('share');
  finish({value: 'stale', validUntil: Infinity});
  await request;
  assert.equal(cache.get('share'), undefined);
});
