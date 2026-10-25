import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file: string) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('photo maps and feedback sit above the actual media layer and retain modal focus', async () => {
  const media = await read('styles/app/40-square-platform.css');
  const map = await read('styles/app/10-chat-city.css');
  const feedback = await read('components/PhotoArchivePlate.css');
  const layer = Number(media.match(/\.dialog-backdrop\.message-image-preview-backdrop\s*\{\s*z-index:\s*(\d+)/)?.[1]);
  const mapLayer = Number(map.match(/\.drawer-backdrop\.media-location-drawer-backdrop\s*\{\s*z-index:\s*(\d+)/)?.[1]);
  assert.ok(mapLayer > layer);
  assert.ok(Number(feedback.match(/app-toast-viewport\s*\{\s*z-index:(\d+)/)?.[1]) > mapLayer);
  assert.match(await read('components/SideDrawer.tsx'), /useModalFocus\(surfaceRef, visible && trapFocus, requestClose\)/);
  assert.match(await read('components/TravelMapDrawer.tsx'), /trapFocus=\{Boolean\(focusLocation\)\}/);
});
test('chat and search previews share sender identity, sending time and message navigation', async () => {
  const chat = await read('components/ChatImagePreview.tsx');
  const page = await read('pages/ChatsPage.tsx');
  const preview = await read('components/ImageLightbox.tsx');
  assert.match(chat, /owner: row.user, createdAt: row.created_at/);
  assert.match(chat, /owner: image.owner, createdAt: image.createdAt/);
  assert.match(chat, /onJumpToMessage\(active.messageId!/);
  assert.doesNotMatch(chat, /t\("media\.(collectionPosition|chatPhotos)"/);
  assert.match(page, /owner: message.user,\s*createdAt: message.created_at/);
  assert.match(page, /onJumpToMessage=\{\(messageId\) => \{ setImagePreview\(null\); revealMessageFromSearch/);
  assert.match(preview, /photo-preview-sender-avatar/);
  assert.match(preview, /dateTime=\{sentAt!\.toISOString\(\)\}/);
});
