import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedReleaseNotes} from '../src/lib/releaseNotes.ts';
const release={id:'2026.11.03.5',publishedAt:'2026-11-03',locales:{'zh-CN':{title:'更新',items:['版本说明']},en:{title:'Update',items:['Release notes']}}};
test('server release notes match the chosen language with Chinese and English fallbacks',()=>{
  assert.equal(localizedReleaseNotes(release,'zh-CN')?.items[0],'版本说明');
  assert.equal(localizedReleaseNotes(release,'zh-TW')?.items[0],'版本说明');
  assert.equal(localizedReleaseNotes(release,'ja')?.items[0],'Release notes');
  assert.equal(localizedReleaseNotes(null,'en'),null);
  assert.equal(localizedReleaseNotes({...release,locales:{}},'en'),null);
});
