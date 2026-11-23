import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainMediaTransform, filmTiles, fitMedia, fitMediaForInfo, lockSwipeAxis, mediaInfoProgress, mediaWheelInput, shouldCompleteSwipe, swipeVelocity} from '../src/lib/mediaDrawerGeometry.ts';

test('desktop wheel input separates vertical panning, horizontal paging, and pinch zoom', () => {
  const wheel = {ctrlKey: false, metaKey: false, shiftKey: false, deltaMode: 0, deltaX: 3, deltaY: 27};
  assert.deepEqual(mediaWheelInput(wheel, 800), {action: 'pan', x: 3, y: 27});
  assert.equal(mediaWheelInput({...wheel, ctrlKey: true}, 800).action, 'zoom');
  assert.equal(mediaWheelInput({...wheel, metaKey: true}, 800).action, 'zoom');
  assert.equal(mediaWheelInput({...wheel, deltaX: 50}, 800).action, 'browse');
  assert.deepEqual(mediaWheelInput({...wheel, shiftKey: true, deltaMode: 1, deltaX: 0, deltaY: 2}, 800),
    {action: 'browse', x: 32, y: 32});
});

test('media fits both stage dimensions and zoom tops out at sixteen times native size', () => {
  const stage = {width: 390, height: 844}, original = {width: 1600, height: 4300};
  const fit = fitMedia(stage, original);
  assert.ok(fit.width < stage.width);
  assert.equal(fit.height, stage.height);
  const enlarged = constrainMediaTransform({scale: 200, x: 0, y: 0}, fit, stage);
  assert.ok(Math.abs(fit.width * enlarged.scale - original.width * 16) < .001);
});

test('zoom out is limited to half the fitted size and panning never exposes space beyond the image', () => {
  const stage = {width: 390, height: 844}, fit = fitMedia(stage, {width: 800, height: 800});
  assert.deepEqual(constrainMediaTransform({scale: .1, x: 120, y: -100}, fit, stage), {scale: .5, x: 0, y: 0});
  assert.deepEqual(constrainMediaTransform({scale: 2, x: 600, y: -600}, fit, stage), {scale: 2, x: 195, y: 0});
});

test('a carousel swipe settles after half the stage width or a flick in the same direction', () => {
  assert.equal(shouldCompleteSwipe(-199, 400, -.2), false);
  assert.equal(shouldCompleteSwipe(-200, 400, 0), true);
  assert.equal(shouldCompleteSwipe(32, 400, .8), true);
  assert.equal(shouldCompleteSwipe(32, 400, -.8), false);
  assert.equal(shouldCompleteSwipe(8, 400, 1), false);
  assert.equal(swipeVelocity([{x: 0, y: 0, time: 10}], {x: 90, y: 0, time: 300}, 'x'), 0);
});

test('vertical intent stays locked after later horizontal movement', () => {
  assert.equal(lockSwipeAxis(4, 5), undefined);
  const vertical = lockSwipeAxis(6, -18);
  assert.equal(vertical, 'free');
  assert.equal(lockSwipeAxis(100, -18, vertical), 'free');
  assert.equal(lockSwipeAxis(18, 6), 'horizontal');
});

test('dragging the information panel down reverses the same progress used to open it', () => {
  assert.equal(mediaInfoProgress(false, -75, 300), .25);
  assert.equal(mediaInfoProgress(true, 225, 300), .25);
  assert.equal(mediaInfoProgress(true, 0, 300), 1);
  assert.equal(mediaInfoProgress(true, 600, 300), 0);
  assert.equal(mediaInfoProgress(false, -600, 300), 1);
});

test('long info initially uses half the stage and a landscape photo grows to fill the space above it', () => {
  const stage = {width: 400, height: 800};
  const fitted = fitMedia(stage, {width: 1600, height: 900});
  const info = fitMediaForInfo(stage, fitted, 650);
  assert.equal(info.panelHeight, 400);
  assert.equal(fitted.height * info.scale, 400);
  assert.equal(info.y, -200);
});

test('short info uses its own height and a tall photo remains bottom aligned', () => {
  const stage = {width: 400, height: 800};
  const fitted = fitMedia(stage, {width: 600, height: 1600});
  const info = fitMediaForInfo(stage, fitted, 200);
  assert.equal(info.panelHeight, 200);
  assert.equal(fitted.width * info.scale, stage.width);
  assert.equal(stage.height / 2 + info.y + fitted.height * info.scale / 2, 600);
});

test('film widths and outside gaps trade places while the shared gap stays large', () => {
  const gap = (tiles: ReturnType<typeof filmTiles>, i: number) => tiles[i + 1].center - tiles[i].center - (tiles[i].width + tiles[i + 1].width) / 2;
  for (const amount of [0, .25, .5, .75, 1]) {
    const tiles = filmTiles(3 + amount, 2, 5);
    assert.equal(tiles[1].width, 36 - 9 * amount);
    assert.equal(tiles[2].width, 27 + 9 * amount);
    assert.equal(gap(tiles, 0), 10 - 7 * amount);
    assert.equal(gap(tiles, 1), 10);
    assert.equal(gap(tiles, 2), 3 + 7 * amount);
    assert.equal(tiles[2].center, 41.5 * (1 - amount));
  }
  assert.equal(filmTiles(0, 0, 6)[0].center, 0);
  assert.ok(filmTiles(-.15, 0, 6)[0].center > 0);
});
