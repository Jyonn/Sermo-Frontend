import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeChatImages, readNewerChatImagePage, type ChatPreviewImage } from '../src/lib/chatImageHistory.ts';
import type { ChatMessageDTO } from '../src/types.ts';

const image = (id: number, uri = `/image-${id}`): ChatPreviewImage => ({ uri, messageId: id });

test('prepending older photos preserves the active message and chronological order', () => {
  const result = mergeChatImages([image(5), image(6)], [image(3), image(4)], 1, 'older');
  assert.deepEqual(result.items.map(item => item.messageId), [3, 4, 5, 6]);
  assert.equal(result.index, 3);
});

test('pagination deduplicates by message, not URL, and keeps newer additions after the collection', () => {
  const result = mergeChatImages([image(5, '/same'), image(6)], [image(6), image(7, '/same')], 0, 'newer');
  assert.deepEqual(result.items.map(item => item.messageId), [5, 6, 7]);
  assert.equal(result.index, 0);
  assert.equal(mergeChatImages([{ uri: '/local', messageId: null }], [], 0, 'older').index, 0);
});

test('forward browsing skips text-only pages and stops at the next image or history end', async () => {
  const cursors: number[] = [];
  const result = await readNewerChatImagePage(10, async (cursor) => {
    cursors.push(cursor);
    return cursor === 10 ? Array.from({ length: 100 }, (_, index) => ({ message_id: 11 + index, type: 0 })) as ChatMessageDTO[]
      : [{ message_id: 111, type: 1, payload: { uri: '/next' } }] as ChatMessageDTO[];
  }, new AbortController().signal);
  assert.deepEqual(cursors, [10, 110]);
  assert.equal(result.after, 111);
  assert.equal(result.hasMore, false);
  assert.equal(result.rows[0].payload?.uri, '/next');
});

test('cancelled history browsing does not continue requesting pages', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(readNewerChatImagePage(1, async () => {
    calls++;
    controller.abort();
    return [];
  }, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('chat browsing uses scoped history, cancellation and stable slide identities', async () => {
  const read = (name: string) => readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
  const chat = await read('ChatImagePreview.tsx');
  const lightbox = await read('ImageLightbox.tsx');
  const plate = await read('PhotoArchivePlate.tsx');
  assert.match(chat, /api.searchMessages\(\{ chat_id: chatId, type: 1, before:/);
  assert.match(chat, /api.getMessages\(\{ chat_id: chatId, after,/);
  assert.match(chat, /readNewerChatImagePage\(cursors.current.newer/);
  assert.match(chat, /controller\?\.abort\(\)/);
  assert.match(chat, /next !== inside.current/);
  assert.match(lightbox, /key=\{item.id \?\?/);
  assert.match(lightbox, /Math.hypot\(event.clientX - gesture.x, event.clientY - gesture.y\)/);
  assert.match(plate, /closest\('button,a,/);
});
