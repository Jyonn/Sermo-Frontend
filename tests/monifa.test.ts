import test from 'node:test';
import assert from 'node:assert/strict';
import {monifaShareUrl} from '../src/lib/monifa.ts';
const url='https://monifa.jyonn.space/#/share/'+'A'.repeat(43);
test('only exact Monifa share links become OTP cards',()=>{
  assert.equal(monifaShareUrl(url),url);
  for(const invalid of ['https://monifa.jyonn.space/',url.replace('/#/share/','/share/'),url+'/more',url.replace('.space/','.space.evil/'),url.replace('https:','http:'),url+'?q=1',url.replace('monifa.','user@monifa.')])assert.equal(monifaShareUrl(invalid),null);
});
