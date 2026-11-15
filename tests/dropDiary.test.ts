import test from 'node:test';
import assert from 'node:assert/strict';
import {diaryExcerpt,remainingShareSeconds,shareClock} from '../src/lib/dropDiary.ts';

test('diary cards cap text at 120 visible characters without breaking emoji',()=>{
  const emoji='👨‍👩‍👧‍👦';
  assert.equal(diaryExcerpt(emoji.repeat(121)),emoji.repeat(120)+'…');
  assert.equal(diaryExcerpt('日'.repeat(121)),'日'.repeat(120)+'…');
  assert.equal(diaryExcerpt('  一小段日记  '),'一小段日记');
  assert.equal(diaryExcerpt('正文👨‍',true),'正文…');
});
test('share expiry uses monotonic deadlines and clamps the exact boundary',()=>{
  assert.equal(remainingShareSeconds(12000,11999),1);
  assert.equal(remainingShareSeconds(12000,12000),0);
  assert.equal(remainingShareSeconds(12000,22000),0);
  assert.deepEqual(shareClock(90061),{days:1,clock:'01:01:01'});
});
