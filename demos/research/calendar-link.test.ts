import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFromLink } from './calendar-link.ts';
const id='35c6deab-103d-4f60-9cf9-9f42c812cc5a';
test('accepts public links on both Chronelle domains',()=>{
  for(const domain of ['chronelle.jyonn.space','chronelle.6-79.cn'])assert.equal(calendarFromLink(`https://${domain}/#/share/${id}`),id);
});
test('rejects keys, foreign hosts, credentials and malformed shares',()=>{
  for(const url of [`https://chronelle.jyonn.space/?key=secret#/share/${id}`,`https://evil.test/#/share/${id}`,`https://user:pass@chronelle.jyonn.space/#/share/${id}`,`https://chronelle.jyonn.space/#/share/${id}?key=secret`,'invalid'])assert.equal(calendarFromLink(url),null);
});
