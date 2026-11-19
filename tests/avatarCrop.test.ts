import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarCropBounds, constrainAvatarCrop, hasTransparentPixels, initialAvatarCrop, resizeAvatarCrop, sizeAvatarCrop } from '../src/lib/avatarCrop.ts';

test('opaque portraits crop to the short edge and stay within the image', () => {
  for (const [width, height] of [[1200, 800], [800, 1200], [64, 64], [8, 20]]) {
    const image = { width, height, transparent: false };
    const initial = initialAvatarCrop(image);
    assert.equal(initial.size, Math.min(width, height));
    const moved = constrainAvatarCrop(image, { x: -500, y: 5000, size: 9999 });
    assert.ok(moved.x >= 0 && moved.y >= 0);
    assert.ok(moved.x + moved.size <= width && moved.y + moved.size <= height);
  }
});

test('transparent artwork can include the complete image with a 1.2x long-edge square', () => {
  const image = { width: 300, height: 1000, transparent: true };
  assert.deepEqual(initialAvatarCrop(image), { x: -450, y: -100, size: 1200 });
  assert.equal(avatarCropBounds(image).maxSize, 1200);
  const crop = sizeAvatarCrop(image, initialAvatarCrop(image), 600);
  assert.deepEqual(crop, { x: -150, y: 200, size: 600 });
  assert.equal(sizeAvatarCrop(image, crop, 2000).size, 1200);
});

test('all four handles keep the opposite corner anchored and respect bounds', () => {
  for (const transparent of [false, true]) {
    const image = { width: 900, height: 600, transparent };
    const crop = sizeAvatarCrop(image, initialAvatarCrop(image), 200);
    const bounds = avatarCropBounds(image);
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      for (const delta of [-1000, -25, 25, 1000]) {
        const resized = resizeAvatarCrop(image, crop, corner, delta, delta);
        const left = corner.includes('w'), top = corner.includes('n');
        assert.equal(resized.x + (left ? resized.size : 0), crop.x + (left ? crop.size : 0));
        assert.equal(resized.y + (top ? resized.size : 0), crop.y + (top ? crop.size : 0));
        assert.ok(resized.x >= bounds.x && resized.y >= bounds.y);
        assert.ok(resized.x + resized.size <= bounds.x + bounds.width);
        assert.ok(resized.y + resized.size <= bounds.y + bounds.height);
        assert.ok(resized.size >= bounds.minSize && resized.size <= bounds.maxSize);
      }
    }
  }
});

test('transparency is detected from alpha pixels, including partial alpha, not the extension', () => {
  assert.equal(hasTransparentPixels(new Uint8ClampedArray([0,0,0,255, 20,30,40,255])), false);
  assert.equal(hasTransparentPixels(new Uint8ClampedArray([0,0,0,255, 20,30,40,254])), true);
  assert.equal(hasTransparentPixels(new Uint8ClampedArray([0,0,0,0])), true);
});
