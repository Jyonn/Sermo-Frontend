import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDateRange,monthDays,monthIndex,MONTH_COUNT} from '../src/lib/calendarDate.ts';
test('calendar covers exactly 1900–2099 with Monday-first offsets',()=>{
 assert.equal(MONTH_COUNT,2400);
 assert.deepEqual(monthDays(0),{year:1900,month:1,offset:0,count:31});
 assert.equal(monthIndex('2099-12-31'),2399);
 assert.equal(monthIndex('2101-01-01'),2399);
 assert.equal(monthIndex('1899-12-31'),0);
 assert.equal(monthDays(monthIndex('1900-02-01')).count,28);
 assert.equal(monthDays(monthIndex('2000-02-01')).count,29);
});
test('one-month default clamps month ends and crosses year boundaries',()=>{
 assert.deepEqual(defaultDateRange(new Date(2026,0,31)),{from:'2026-01-31',to:'2026-02-28'});
 assert.deepEqual(defaultDateRange(new Date(2024,0,31)),{from:'2024-01-31',to:'2024-02-29'});
 assert.deepEqual(defaultDateRange(new Date(2026,11,5)),{from:'2026-12-05',to:'2027-01-05'});
});
