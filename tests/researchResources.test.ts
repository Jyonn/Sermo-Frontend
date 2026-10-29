import test from 'node:test';
import assert from 'node:assert/strict';
import { resourcePath } from '../src/lib/researchResources.ts';

const folder=(id:number,parent_id:number|null)=>({id,parent_id,kind:'folder' as const,name:`Folder ${id}`,size:null,creator_id:1,created_at:'2026-10-29',can_delete:true});
test('resource navigation preserves the two-level path and handles root',()=>{
  const items=[folder(1,null),folder(2,1),folder(3,null)];
  assert.deepEqual(resourcePath(items,null),[]);
  assert.deepEqual(resourcePath(items,2).map(item=>item.id),[1,2]);
  assert.deepEqual(resourcePath(items,3).map(item=>item.id),[3]);
  assert.deepEqual(resourcePath(items,99),[]);
});
test('resource navigation terminates safely for malformed cycles',()=>{
  assert.equal(resourcePath([folder(1,2),folder(2,1)],1).length,2);
});
