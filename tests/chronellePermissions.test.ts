import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changeCalendarPermission,permissionMode,visibilityRank,type CalendarPermissions} from '../src/lib/chronellePermissions.ts';
const initial=():CalendarPermissions=>({strangers:{default:'busy',overrides:{}},friends:{default:'busy',overrides:{}}});
const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('all-group visibility applies to future groups and clears that audience overrides',()=>{
  const value=initial();value.strangers.overrides['7']='hidden';
  const next=changeCalendarPermission(value,'strangers','detail');
  assert.equal(permissionMode(next.strangers,99),'detail');
  assert.deepEqual(next.strangers.overrides,{});
  assert.equal(next.friends.default,'detail');
  assert.equal(value.strangers.default,'busy');
});
test('increasing stranger group access also raises friend access and inherit removes overrides',()=>{
  const next=changeCalendarPermission(initial(),'strangers','detail',7);
  assert.equal(permissionMode(next.friends,7),'detail');
  const removed=changeCalendarPermission(next,'strangers','inherit',7);
  assert.equal(permissionMode(removed.strangers,7),'busy');
  assert.equal(permissionMode(removed.friends,7),'detail');
});
test('every sequence of global and group edits preserves the friend floor',()=>{
  let value=initial();
  for(const tier of ['friends','strangers'] as const)for(const mode of ['hidden','busy','detail','inherit'] as const)for(const id of [undefined,7,8]){
    value=changeCalendarPermission(value,tier,mode,id);
    for(const group of [undefined,7,8,99])assert.ok(visibilityRank[permissionMode(value.friends,group)]>=visibilityRank[permissionMode(value.strangers,group)]);
  }
});
test('plugin, research and post-binding gate use the shared permissions drawer',()=>{
  for(const path of ['components/ChronellePluginDialog.tsx','components/ResearchCalendar.tsx','components/ChronelleBindingGate.tsx'])assert.match(read(path),/<ChronellePermissionsDrawer/);
  assert.match(read('components/ChronelleBindingGate.tsx'),/permissions_review_required/);
  assert.doesNotMatch(read('components/ResearchCalendar.tsx'),/action: 'policy'/);
  assert.match(read('components/ChronellePluginDialog.tsx'),/bindingConsentShort/);
  assert.match(read('components/ChronellePermissionsDrawer.tsx'),/<FloatingDrawerScope>/);
});
