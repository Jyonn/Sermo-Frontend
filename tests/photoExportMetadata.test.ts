import test from 'node:test';
import assert from 'node:assert/strict';
import exifr from 'exifr';
import {addSelectedPhotoMetadata, readPhotoMetadata} from '../src/lib/photoMetadata.ts';

const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE3sAAAAASUVORK5CYII=', 'base64')], {type: 'image/png'});
const capture = {make: 'Fujifilm', model: 'X-T5', lens: 'XF 23mm', dateTaken: '2026:11:22 12:30:01', latitude: 30.31, longitude: 120.14, description: 'City'};

test('edited photos keep camera data and omit location and caption when toggled off', async () => {
  const blob = addSelectedPhotoMetadata(png, capture, false, false);
  const result = await exifr.parse(await blob.arrayBuffer(), {gps: true, reviveValues: false});
  assert.equal(result.Make, capture.make);
  assert.equal(result.Model, capture.model);
  assert.equal(result.LensModel, capture.lens);
  assert.equal(result.DateTimeOriginal, capture.dateTaken);
  assert.equal(result.ImageDescription, undefined);
  assert.equal(result.latitude, undefined);
});

test('selected location and caption can be decoded from an edited photo', async () => {
  const blob = addSelectedPhotoMetadata(png, capture, true, true);
  const file = new File([blob], 'capture.png', {type: blob.type});
  const result = await readPhotoMetadata(file);
  assert.equal(result.dateTaken, capture.dateTaken);
  assert.equal(result.description, capture.description);
  assert.ok(Math.abs(result.latitude! - capture.latitude) < .000001);
  assert.ok(Math.abs(result.longitude! - capture.longitude) < .000001);
});
