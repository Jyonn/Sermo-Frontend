import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file: string) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('photo maps and feedback sit above the actual media layer and retain modal focus', async () => {
  const map = await read('styles/app/10-chat-city.css');
  const feedback = await read('components/MediaDrawer.css');
  const layer = Number(map.match(/\.drawer-backdrop\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  const mapLayer = Number(map.match(/\.drawer-backdrop\.media-location-drawer-backdrop\s*\{\s*z-index:\s*(\d+)/)?.[1]);
  assert.ok(mapLayer > layer);
  assert.ok(Number(feedback.match(/app-toast-viewport\s*\{\s*z-index:\s*(\d+)/)?.[1]) > mapLayer);
  assert.match(await read('components/SideDrawer.tsx'), /useModalFocus\(surfaceRef, visible && trapFocus, requestClose(?:,\s*\{manageLayer:false\})?\)/);
  assert.match(await read('components/TravelMapDrawer.tsx'), /trapFocus=\{Boolean\(focusLocation\)\}/);
});

test('video previews reuse the photo shell and toolbar without the retired second toolbar', async () => {
  const preview = await read('components/MediaDrawer.tsx');
  const styles = await read('components/MediaDrawer.css');
  assert.match(preview, /videoItem && src && <div className="media-drawer-transport"/);
  assert.match(preview, /!immersive && !hideFilm && filmStrip/);
  assert.doesNotMatch(preview, /message-image-preview-toolbar/);
  assert.match(preview, /releaseMediaPlayback\(node\); node.pause\(\)/);
  assert.match(preview, /video.current.currentTime = event.currentTarget.valueAsNumber/);
  assert.match(styles, /\.has-media-info \.media-drawer-canvas\s*\{\s*inset: auto 0 0;\s*width: 100%;/);
});
test('chat and search previews share sender identity, sending time and message navigation', async () => {
  const chat = await read('components/ChatImagePreview.tsx');
  const page = await read('pages/ChatsPage.tsx');
  const preview = await read('components/MediaDrawer.tsx');
  assert.match(chat, /owner: row.user, createdAt: row.created_at/);
  assert.match(chat, /owner: image.owner, createdAt: image.createdAt/);
  assert.match(chat, /onJumpToMessage\(active.messageId!/);
  assert.doesNotMatch(chat, /t\("media\.(collectionPosition|chatPhotos)"/);
  assert.match(page, /owner: message.user,\s*createdAt: message.created_at/);
  assert.match(page, /onJumpToMessage=\{\(messageId\) => \{ setImagePreview\(null\); revealMessageFromSearch/);
  assert.match(preview, /media-drawer-avatar/);
  assert.match(preview, /dateTime=\{date\.toISOString\(\)\}/);
});
