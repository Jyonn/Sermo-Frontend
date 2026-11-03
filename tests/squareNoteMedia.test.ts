import test from 'node:test';
import assert from 'node:assert/strict';
import {squareDetailView,squareStatementSearch,squareNotePhotos} from '../src/lib/squareNoteMedia.ts';
import type {SquareStatementDTO,StillfolioCollectionDTO} from '../src/types.ts';
test('detail navigation preserves feed filters and explicitly selects its presentation',()=>{
  const note=squareStatementSearch('?user_id=7&keyword=hello&panel=profile','note');
  assert.equal(squareDetailView(note),'note');
  assert.equal(new URLSearchParams(note).get('user_id'),'7');
  assert.equal(new URLSearchParams(note).get('keyword'),'hello');
  assert.equal(new URLSearchParams(note).has('panel'),false);
  const classic=squareStatementSearch(note,'classic');
  assert.equal(squareDetailView(classic),'classic');
  assert.equal(new URLSearchParams(classic).has('view'),false);
  assert.equal(squareDetailView('?view=unsupported'),'classic');
});
test('uploaded images keep original order and metadata while ignoring audio and video',()=>{
  const s={media:[{kind:'image',uri:'one',thumbnail_uri:'thumb',metadata:{status:1,iso:100}},{kind:'video',uri:'video'},{kind:'image',uri:'two'}]} as SquareStatementDTO;
  const photos=squareNotePhotos(s);
  assert.deepEqual(photos.map(item=>item.uri),['one','two']);
  assert.equal(photos[0].poster,'thumb');assert.equal(photos[0].metadata?.iso,100);
  assert.equal(photos[0].external,false);
});
test('StillFolio metadata matches image position and older collections remain readable',()=>{
  const s={media:[]} as unknown as SquareStatementDTO;
  const collection={images:['one','two'],image_metadata:[{status:1,iso:200},null]} as StillfolioCollectionDTO;
  const photos=squareNotePhotos(s,collection);
  assert.equal(photos[0].metadata?.iso,200);assert.equal(photos[1].metadata,null);
  assert.equal(photos[0].external,true);
  assert.equal(squareNotePhotos(s,{...collection,image_metadata:undefined})[1].uri,'two');
  assert.deepEqual(squareNotePhotos(s),[]);
});
