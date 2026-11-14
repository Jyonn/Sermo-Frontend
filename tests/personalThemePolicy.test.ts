import assert from 'node:assert/strict';
import test from 'node:test';
import {availablePersonalThemes,selectedPersonalTheme} from '../src/lib/personalThemePolicy.ts';
const at=(date:string)=>Date.parse(date+'+08:00');
const auto=(date:string,birthday=false)=>selectedPersonalTheme(availablePersonalThemes(at(date),birthday),null);
test('Christmas unlocks at Beijing midnight on November 26 and expires January 1',()=>{
  assert.equal(auto('2026-11-25T23:59:59'),'default');
  assert.equal(auto('2026-11-26T00:00:00'),'christmas-2026');
  assert.equal(auto('2026-12-31T23:59:59'),'christmas-2026');
  assert.equal(auto('2027-01-01T00:00:00'),'default');
});
test('birthday takes priority, then falls back to Christmas or default',()=>{
  assert.equal(auto('2026-12-01T12:00:00',true),'birthday-botanical');
  assert.equal(auto('2026-12-02T00:00:00'),'christmas-2026');
  assert.equal(auto('2026-07-01T12:00:00',true),'birthday-botanical');
  assert.equal(auto('2026-07-02T00:00:00'),'default');
});
test('manual choices survive reopening within the period; new unlocks switch automatically',()=>{
  const holiday=availablePersonalThemes(at('2026-12-01T12:00:00'),false);
  const saved={period:holiday.map(x=>x.token).join('|'),theme:'default'};
  assert.equal(selectedPersonalTheme(holiday,saved),'default');
  const birthday=availablePersonalThemes(at('2026-12-01T12:00:00'),true,'2026-birthday');
  assert.equal(selectedPersonalTheme(birthday,saved),'birthday-botanical');
  assert.equal(selectedPersonalTheme(availablePersonalThemes(at('2027-12-01T12:00:00'),false),saved),'christmas-2026');
  assert.equal(selectedPersonalTheme(holiday,{period:saved.period,theme:'birthday-botanical'}),'christmas-2026');
});
test('unlock identities distinguish celebrations and Christmas years for discovery',()=>{
  const now=at('2026-12-01T12:00:00');
  assert.deepEqual(availablePersonalThemes(now,true,'occasion-1').map(x=>x.token),['default','christmas:2026','birthday:occasion-1']);
  assert.deepEqual(availablePersonalThemes(at('2027-01-01T00:00:00'),false).map(x=>x.token),['default']);
});
