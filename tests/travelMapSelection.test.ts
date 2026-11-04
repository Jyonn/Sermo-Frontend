import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedMapOwners,toggleMapOwner} from '../src/lib/travelMapSelection.ts';
const maps=[1,2,3].map(user_id=>({owner:{user_id}}));
test('own footprints remain visible even if selection excludes self',()=>{
  assert.deepEqual(selectedMapOwners(maps,[2],1).map(item=>item.owner.user_id),[1,2]);
  assert.deepEqual(selectedMapOwners(maps,[],1).map(item=>item.owner.user_id),[1]);
  assert.deepEqual(selectedMapOwners(maps,null,1),maps);
});
test('toggle updates are based on the latest selection and cannot remove self',()=>{
  const first=toggleMapOwner(null,2,1,[1,2,3]);
  assert.deepEqual(first,[1,3]);
  assert.deepEqual(toggleMapOwner(first,2,1,[1,2,3]),[1,3,2]);
  assert.deepEqual(toggleMapOwner(first,1,1,[1,2,3]),first);
});
