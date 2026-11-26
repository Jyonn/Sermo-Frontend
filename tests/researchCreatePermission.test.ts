import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { researchCreateRestriction } from '../src/lib/researchCreatePermission.ts';
import type { UserGrowthDTO } from '../src/types.ts';
function account(level:number,verified=true,required=4,available=false){return {verified,growth:{level,capabilities:{'chat.group.create':{required_level:required,available}}} as UserGrowthDTO};}
test('low-level accounts receive the required and current levels',()=>{
  assert.deepEqual(researchCreateRestriction(account(3)),{key:'research.createNeedsLevel',values:{level:4,current:3}});
});
test('verification and combined requirements are distinguished',()=>{
  assert.equal(researchCreateRestriction(account(3,false))?.key,'research.createNeedsLevelAndVerification');
  assert.equal(researchCreateRestriction(account(4,false))?.key,'research.createNeedsVerification');
});
test('the server capability result and required level remain authoritative',()=>{
  assert.equal(researchCreateRestriction(account(2,true,4,true)),null);
  assert.deepEqual(researchCreateRestriction(account(5,true,8)),{key:'research.createNeedsLevel',values:{level:8,current:5}});
  assert.equal(researchCreateRestriction(account(10,true,4))?.key,'research.createDenied');
  assert.equal(researchCreateRestriction({verified:true}),null);
});
test('creation uses the capability preflight and shows errors in the open form',()=>{
  const page=readFileSync(new URL('../src/pages/ResearchPage.tsx',import.meta.url),'utf8');
  assert.match(page,/<ResearchHome[^>]+create=\{\(\) => void startCreate\(\)\}/);
  assert.match(page,/label=\{t\("research.create"\)\} onClick=\{\(\) => void startCreate\(\)\}/);
  assert.match(page,/researchCreateRestriction\(me\)[\s\S]+showPanel\("create"\)/);
  assert.match(page,/setError\(message\)/);
  assert.match(page,/<ResearchCreateFlow busy=\{busy\} error=\{error\}/);
});
