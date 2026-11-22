import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainMediaTransform, fitMedia} from '../src/lib/mediaDrawerGeometry.ts';

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
