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
test('all creation entry points use the shared preflight and submit failures toast too',()=>{
  const page=readFileSync(new URL('../src/pages/ResearchPage.tsx',import.meta.url),'utf8');
  assert.equal((page.match(/startCreate\(\)}/g)||[]).length,4);
  assert.equal((page.match(/setPanel\('create'\)/g)||[]).length,1);
  assert.match(page,/setError\(message\);showToast\(message,'error',4000\)/);
});
