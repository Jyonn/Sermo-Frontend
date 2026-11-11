import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {actionsForKind} from '../src/lib/chatQuickActions.ts';

function setup(){
  const values=new Map<string,string>(),exports:Record<string,any>={};
  let saved:any={preferences:{direct:['locked','calendar'],group:['locked','copy','status']},configured:false,revision:0,call_hint_seen:false};
  const calls:any[]=[];let blocked=false,storageBlocked=false;
  const api={getChatQuickActions:async()=>structuredClone(saved),saveChatQuickActions:async(scope:string,body:any)=>{
    if(blocked)throw Error('offline');calls.push({scope,body});
    if(body.kind)saved.preferences[body.kind]=body.actions;
    if(body.migrate&&!saved.configured)saved.preferences=body.migrate;
    if(body.kind||body.migrate)saved.configured=true;
    if(body.acknowledge_call_hint)saved.call_hint_seen=true;
    saved.revision++;return structuredClone(saved);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/chatQuickActionSync.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(storageBlocked)throw Error();values.set(key,value)}},
    require(id:string){if(id==='./api')return{api};if(id==='./chatQuickActions')return{actionsForKind};throw Error(id)},
  });
  return {store:exports,values,calls,setSaved:(value:any)=>{saved=value},block:()=>{blocked=true},blockStorage:()=>{storageBlocked=true},api};
}
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
test('local settings migrate once, concurrent kinds save independently, and failures retain server state',async()=>{
  const {store,values,calls,block}=setup();
  values.set('frienden:chat-quick-actions:v1:1:7',JSON.stringify(['status','calendar','locked']));
  await store.refreshChatShortcuts('1:7');
  assert.equal(calls.length,1);
  assert.deepEqual(plain(store.shortcutSnapshot('1:7').preferences),{direct:['calendar','locked'],group:['status','locked']});
  assert.deepEqual(await Promise.all([store.saveChatShortcuts('1:7',{kind:'direct',actions:['call']}),store.saveChatShortcuts('1:7',{kind:'group',actions:['search']})]),[true,true]);
  assert.deepEqual(plain(store.shortcutSnapshot('1:7').preferences),{direct:['call'],group:['search']});
  await store.refreshChatShortcuts('1:7');assert.equal(calls.length,3);
  block();assert.equal(await store.saveChatShortcuts('1:7',{kind:'direct',actions:['locked']}),false);
  assert.deepEqual(plain(store.shortcutSnapshot('1:7').preferences.direct),['call']);
  assert.deepEqual(plain(store.shortcutSnapshot('2:8').preferences.direct),['locked','calendar']);
});
test('configured server wins over stale local settings and browser storage is optional',async()=>{
  const {store,values,calls,setSaved,blockStorage}=setup();
  values.set('frienden:chat-quick-actions:v2:1:7',JSON.stringify({direct:['locked'],group:['status']}));
  setSaved({preferences:{direct:['call'],group:['copy']},configured:true,revision:3,call_hint_seen:false});
  blockStorage();await store.refreshChatShortcuts('1:7');assert.equal(calls.length,0);
  assert.deepEqual(plain(store.shortcutSnapshot('1:7').preferences.direct),['call']);
  assert.equal(await store.saveChatShortcuts('1:7',{acknowledge_call_hint:true}),true);
  assert.equal(store.shortcutSnapshot('1:7').call_hint_seen,true);
});
test('an older in-flight read cannot overwrite a newer save',async()=>{
  const {store,api}=setup();await store.refreshChatShortcuts('1:7');
  let resolve!:(value:any)=>void;api.getChatQuickActions=()=>new Promise(done=>{resolve=done});
  const read=store.refreshChatShortcuts('1:7');
  await store.saveChatShortcuts('1:7',{kind:'direct',actions:['call']});
  resolve({preferences:{direct:['locked'],group:['copy']},configured:true,revision:0,call_hint_seen:false});
  await read;assert.deepEqual(plain(store.shortcutSnapshot('1:7').preferences.direct),['call']);
});
