import test from 'node:test';
import assert from 'node:assert/strict';
import {RESOURCE_CATEGORIES,resourcesInCategory} from '../src/lib/resourceCategories.ts';
import type {ResourceCollectionDTO} from '../src/types';
test('appearance categories stay separate from activities and preserve collection identity',()=>{
  const rows=['activity','emoji','avatar-frame','background','profile-card','bubble'].map((category,index)=>({category,slug:`collection-${index}`})) as ResourceCollectionDTO[];
  for(const kind of RESOURCE_CATEGORIES){const selected=resourcesInCategory(rows,kind.id);assert.ok(selected.every(row=>row.category===kind.id));if(kind.id!=='illustration')assert.equal(selected.length,1)}
  assert.equal(resourcesInCategory(rows,'bubble')[0],rows[5]);
});
