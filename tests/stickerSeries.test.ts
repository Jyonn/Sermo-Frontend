import assert from 'node:assert/strict';
import test from 'node:test';
import {validStickerSeriesName,validStickerDescription} from '../src/lib/stickerSeries.ts';
test('series names use the same combined Chinese and English budget as the server',()=>{
  for(const name of ['五个中文字','abcdefghij','小哀abcdef'])assert.ok(validStickerSeriesName(name));
  for(const name of ['六个中文字啊','abcdefghijk','小哀abcdefg','','../foo','😃'])assert.equal(validStickerSeriesName(name),false);
});
test('sticker descriptions require short readable text with the same server budget',()=>{
  for(const value of ['开心','abcdefghijklmno','八个汉字描述上限'])assert.ok(validStickerDescription(value));
  for(const value of ['',' ','a'.repeat(17),'九个汉字描述超过限额','bad\nline'])assert.equal(validStickerDescription(value),false);
});
