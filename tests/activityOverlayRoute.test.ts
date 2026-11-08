import assert from 'node:assert/strict';
import test from 'node:test';
import {activityKeyFromSearch,activityOverlaySearch} from '../src/lib/activityOverlayRoute.ts';

test('opening and closing an activity preserves the menu drawer and other filters',()=>{
  const original='?panel=activities&keyword=hello';
  const opened=activityOverlaySearch(original,'explorer-2026');
  assert.equal(activityKeyFromSearch(opened),'explorer-2026');
  assert.equal(activityOverlaySearch(opened,null),original);
});
test('chat context survives changing activities without a Square route',()=>{
  const params=new URLSearchParams(activityOverlaySearch('?panel=details&activity=old&focus=15','starry-night-five-evenings-2026'));
  assert.equal(params.get('panel'),'details');
  assert.equal(params.get('focus'),'15');
  assert.equal(params.getAll('activity').length,1);
  assert.equal(params.get('activity'),'starry-night-five-evenings-2026');
});
test('malformed or absent activity keys do not open an overlay',()=>{
  for(const value of ['','?activity=','?activity=../../admin','?activity=%3Cscript%3E',`?activity=${'a'.repeat(121)}`])assert.equal(activityKeyFromSearch(value),null);
});
