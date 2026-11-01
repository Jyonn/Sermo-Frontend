import test from 'node:test';
import assert from 'node:assert/strict';
import { historyDay, historyDayRange, historyTypeOptions, rangeSelection, selectionInRectangle } from '../src/lib/historyManagement.ts';

test('date sections and bounds use Shanghai midnight including next-day UTC boundaries', () => {
  const range = historyDayRange('2026-11-01');
  assert.equal(range.end - range.start, 86400);
  assert.equal(historyDay(range.start - 1), '2026-10-31');
  assert.equal(historyDay(range.start), '2026-11-01');
  assert.equal(historyDay(range.end), '2026-11-02');
});
test('shift selection follows visual message order in either direction', () => {
  assert.deepEqual(rangeSelection([9,8,7,6],8,6),[8,7,6]);
  assert.deepEqual(rangeSelection([9,8,7,6],6,8),[8,7,6]);
  assert.deepEqual(rangeSelection([9,8,7,6],null,7),[7]);
});
test('rectangle selection includes every intersecting row, but excludes mere edge contact', () => {
  const rows = [{id:1,left:0,right:100,top:0,bottom:30},{id:2,left:120,right:220,top:0,bottom:30},{id:3,left:0,right:100,top:40,bottom:70}];
  assert.deepEqual(selectionInRectangle({left:20,right:150,top:5,bottom:35},rows),[1,2]);
  assert.deepEqual(selectionInRectangle({left:100,right:120,top:5,bottom:35},rows),[]);
});
test('type filters cover all types, including system records and invitations', () => {
  const types = historyTypeOptions.flatMap(option => option.types.split(',').map(Number)).sort((a,b)=>a-b);
  assert.deepEqual(types, Array.from({length:14},(_,index)=>index));
});
