import assert from 'node:assert/strict';
import test from 'node:test';
import {validStickerSeriesName} from '../src/lib/stickerSeries.ts';
test('series names use the same combined Chinese and English budget as the server',()=>{
  for(const name of ['五个中文字','abcdefghij','小哀abcdef'])assert.ok(validStickerSeriesName(name));
  for(const name of ['六个中文字啊','abcdefghijk','小哀abcdefg','','../foo','😃'])assert.equal(validStickerSeriesName(name),false);
});
