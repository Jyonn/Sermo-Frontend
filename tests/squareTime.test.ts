import test from 'node:test';
import assert from 'node:assert/strict';
import {formatSquareTime} from '../src/lib/squareTime.ts';
process.env.TZ='Asia/Shanghai';
const now=new Date('2026-11-04T12:00:00+08:00');
const format=(date:string,language='zh-CN')=>formatSquareTime(new Date(date).getTime()/1000,language,language==='en'?'Yesterday':'昨天',now);
test('today omits the date and yesterday is based on calendar days',()=>{
  assert.equal(format('2026-11-04T09:05:00+08:00'),'09:05');
  assert.equal(format('2026-11-03T23:50:00+08:00'),'昨天 23:50');
});
test('days two through six show weekdays and seven days shows a date',()=>{
  assert.equal(format('2026-11-02T09:05:00+08:00'),'周一 09:05');
  assert.equal(format('2026-10-29T09:05:00+08:00'),'周四 09:05');
  assert.equal(format('2026-10-28T09:05:00+08:00'),'10月28日');
  assert.equal(format('2025-10-28T09:05:00+08:00'),'2025年10月28日');
});
test('English dates and weekdays are localized',()=>{
  assert.equal(format('2026-11-03T09:05:00+08:00','en'),'Yesterday 09:05');
  assert.equal(format('2026-11-02T09:05:00+08:00','en'),'Mon 09:05');
  assert.equal(format('2026-10-28T09:05:00+08:00','en'),'Oct 28');
});
test('calendar arithmetic handles daylight-saving days and midnight correctly',()=>{
  process.env.TZ='America/New_York';
  try{
    assert.equal(formatSquareTime(new Date('2026-11-01T00:30:00-04:00').getTime()/1000,'en','Yesterday',new Date('2026-11-02T00:15:00-05:00')),'Yesterday 00:30');
  }finally{process.env.TZ='Asia/Shanghai'}
});
