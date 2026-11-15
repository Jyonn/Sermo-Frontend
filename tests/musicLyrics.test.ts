import test from 'node:test';
import assert from 'node:assert/strict';
import {musicLyrics, lyricScrollTop, musicTime} from '../src/lib/musicLyrics.ts';

test('timed original and translation are shared by card and floating-player drawers', () => {
  const rows = musicLyrics({original: '[ar:artist]\n[00:10.50][00:30.500]两次副歌\n[00:05]前奏', translation: '[00:10.5]Chorus'});
  assert.deepEqual(rows.map(x => x.time), [5, 10.5, 30.5]);
  assert.equal(rows[1].translation, 'Chorus');
  assert.equal(rows[2].translation, undefined);
});
test('synchronized millisecond cues take priority over legacy LRC', () => {
  assert.deepEqual(musicLyrics({original:'[00:01]old', cues:[{time_ms:2500,text:'new'}]}).map(x => [x.time,x.text]), [[2.5,'new']]);
});
test('lyric following computes local viewport scroll without moving its ancestors', () => {
  assert.equal(lyricScrollTop(200, 180, 40, 200), 300);
  assert.equal(lyricScrollTop(0, 0, 40, 200), 0);
  assert.equal(musicTime(185.9), '3:05');
  assert.equal(musicTime(NaN), '0:00');
});
