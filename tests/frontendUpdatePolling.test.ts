import test from 'node:test';
import assert from 'node:assert/strict';
import {startFrontendUpdatePolling} from '../src/lib/frontendUpdatePolling.ts';

const result=(version:string|null,failed=false)=>({currentRelease:{id:'2026.11.03.1',publishedAt:'2026-11-03',locales:{}},latestRelease:null,latestVersion:version,updateAvailable:Boolean(version),sources:[],catalogUnavailable:failed});
const flush=()=>new Promise(setImmediate);
test('interval detection notifies once per new release, pauses when hidden, and survives network errors',async()=>{
  let tick=()=>{},calls=0,toasts=0,active=true,latest=result(null),cleared=false;
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
  const clock={setInterval:(callback:()=>void,ms:number)=>{assert.equal(ms,180000);tick=callback;return 1},clearInterval:()=>{cleared=true}};
  const task=startFrontendUpdatePolling({check:async()=>{calls++;return latest},notify:()=>toasts++,isActive:()=>active,storage,clock});
  await flush();assert.equal(calls,1);assert.equal(toasts,0);
  latest=result('2026.11.03.2');tick();await flush();assert.equal(toasts,1);
  tick();await flush();assert.equal(toasts,1);
  active=false;tick();await flush();assert.equal(calls,3);
  active=true;latest=result('2026.11.03.3',true);await task.poll();assert.equal(toasts,1);
  latest=result('2026.11.03.3');await task.poll();assert.equal(toasts,2);
  task.stop();assert.ok(cleared);tick();await flush();assert.equal(calls,5);
  const again=startFrontendUpdatePolling({check:async()=>latest,notify:()=>toasts++,isActive:()=>true,storage,clock});
  await flush();assert.equal(toasts,2);again.stop();
});
test('an unmounted poller never notifies for a late response',async()=>{
  let resolve!:(value:ReturnType<typeof result>)=>void,toasts=0;
  const task=startFrontendUpdatePolling({check:()=>new Promise(done=>{resolve=done}),notify:()=>toasts++,isActive:()=>true,clock:{setInterval:()=>1,clearInterval:()=>{}}});
  task.stop();resolve(result('2026.11.03.2'));await flush();assert.equal(toasts,0);
});
