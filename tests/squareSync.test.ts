import test from 'node:test';
import assert from 'node:assert/strict';
import {applySquareSync,reconcileSquareItems,rememberSquareResponse,squareSyncRevision,filterSquareRemoved} from '../src/lib/squareSync.ts';
import {readTabCache,writeTabCache} from '../src/lib/tabCache.ts';

const storage:Record<string,unknown>={};
Object.defineProperties(storage,{
  getItem:{value:(key:string)=>storage[key]??null},
  setItem:{value:(key:string,value:string)=>{storage[key]=value}},
});
const target=new EventTarget();
Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage,dispatchEvent:target.dispatchEvent.bind(target)}});

test('a confirmed deletion removes all feed/filter caches but preserves other accounts and paging',()=>{
  const snapshot={version:2,items:[{statement_id:1},{statement_id:2}],hasMore:true};
  for(const key of ['square:all','square:mine','square:user:9:keyword:hello'])writeTabCache('1:2',key,snapshot);
  writeTabCache('1:3','square:all',snapshot);
  writeTabCache('1:2','square:all:scroll',512);
  applySquareSync('1:2',{items:[],removed_ids:[1]});
  for(const key of ['square:all','square:mine','square:user:9:keyword:hello'])assert.deepEqual(readTabCache('1:2',key)?.data,{...snapshot,items:[{statement_id:2}]});
  assert.deepEqual(readTabCache('1:3','square:all')?.data,snapshot);
  assert.equal(readTabCache('1:2','square:all:scroll')?.data,512);
});

test('patches update existing posts without inserting into unrelated filtered feeds',()=>{
  const result=reconcileSquareItems([{statement_id:1,text:'Keep'},{statement_id:2,text:'Remove'}],{items:[{statement_id:1,liked:true,like_count:7},{statement_id:3,text:'Not in filter'}],removed_ids:[2]});
  assert.deepEqual(result,[{statement_id:1,text:'Keep',liked:true,like_count:7}]);
});
test('unchanged synchronization preserves item and list identity',()=>{
  const items=[{statement_id:1,like_count:2,liked:true}];
  assert.equal(reconcileSquareItems(items,{items:[{statement_id:1,like_count:2,liked:true}],removed_ids:[]}),items);
});

test('a pre-deletion request cannot resurrect a post but a fresh authoritative response can restore access',()=>{
  const scope='race:1',before=squareSyncRevision(scope);
  rememberSquareResponse(scope,'/square/statements/8','DELETE',{},before);
  assert.deepEqual(rememberSquareResponse(scope,'/square/statements','GET',[{statement_id:8},{statement_id:9}],before),[{statement_id:9}]);
  assert.deepEqual(filterSquareRemoved(scope,[{statement_id:8}]),[]);
  assert.deepEqual(rememberSquareResponse(scope,'/square/statements','GET',[{statement_id:8}],squareSyncRevision(scope)),[{statement_id:8}]);
});

test('successful likes from any caller update every cached copy',()=>{
  const scope='like:1';
  writeTabCache(scope,'square:all',{version:2,items:[{statement_id:3,text:'Hi',liked:false,like_count:0}],hasMore:false});
  rememberSquareResponse(scope,'/square/statements/3/like','POST',{liked:true,like_count:1},0);
  assert.deepEqual((readTabCache<{items:unknown[]}>(scope,'square:all')?.data.items),[{statement_id:3,text:'Hi',liked:true,like_count:1}]);
});
test('older feed and detail requests cannot roll back a successful like',()=>{
  const scope='like:race',revision=squareSyncRevision(scope);
  rememberSquareResponse(scope,'/square/statements/3/like','POST',{liked:true,like_count:5},revision);
  const stale={statement_id:3,liked:false,like_count:4};
  assert.equal(rememberSquareResponse(scope,'/square/statements','GET',[stale],revision)[0].like_count,5);
  assert.equal(rememberSquareResponse(scope,'/square/statements/3','GET',stale,revision).liked,true);
});
