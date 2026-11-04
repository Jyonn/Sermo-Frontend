import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Run the production guard with controlled hook state and deferred API responses.
// Keeping storage empty also exercises continuity when persistent cache is unavailable.
function harness(cached=false){
  const slots:any[]=[];let index=0;let jobs:Array<()=>void>=[];
  const requests:Array<{resolve:(value:any)=>void;reject:(error:Error)=>void}>=[];
  let session:any={accessToken:'first',user:{user_id:1,space_id:1,name:'User'}};
  let listener:((value?:any)=>void)|undefined;
  const auth={ready:true,get session(){return session},logout(){}};
  const React=createRequire(import.meta.url)('react');
  const hooks={...React,createContext:()=>({}),useContext:()=>auth,
    useState(initial:any){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next}]},
    useRef(initial:any){const i=index++;return slots[i]??(slots[i]={current:initial})},
    useEffect(effect:()=>any,deps:any[]){const i=index++;const previous=slots[i];if(!previous||deps.some((v,j)=>v!==previous.deps[j])){jobs.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()}})}},
  };
  const api={getGestureLockPrefs:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))};
  const gesture={getGestureLockScope:(s:any)=>`${s.user.space_id}:${s.user.user_id}`,readCachedGestureLockPreference:()=>({found:cached,preference:null}),isGestureUnlocked:()=>false,isGestureLockPreferenceEnabled:(p:any)=>!!p?.enabled,cacheGestureLockPreference(){},listenGestureLockPreferenceUpdated:(fn:any)=>{listener=fn;return()=>{listener=undefined}},markGestureLocked(){}};
  const exports:any={};const require=createRequire(import.meta.url);
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/auth.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require:(name:string)=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):name==='react-router-dom'?{useLocation:()=>({pathname:'/app/chats',search:''}),Navigate:()=>null}:name==='./api'?{api,configureApiAuth(){}}:name==='./gestureLock'?gesture:name==='./i18n'?{i18n:{t:(key:string)=>key}}:name==='../components/GestureLock'?{GestureUnlockScreen:()=>null}:{},
  });
  function render(){index=0;const view=exports.RequireAuth({children:'chat-page'});const work=jobs;jobs=[];work.forEach(fn=>fn());return view}
  return{render,requests,refresh:()=>{session={...session,accessToken:'renewed'}},switchAccount:()=>{session={accessToken:'other',user:{user_id:2,space_id:1,name:'Other'}}},recheck:()=>listener?.(),update:(p:any)=>listener?.(p)};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const restoring=(view:any)=>view.type==='main'&&view.props.className==='auth-restore-screen';

test('initial unknown security policy blocks the page until checked',async()=>{
  const h=harness();assert.ok(restoring(h.render()));assert.ok(restoring(h.render()));
  h.requests[0].resolve({enabled:false});await settle();assert.equal(h.render().props.children[0],'chat-page');
});
test('same-account token renewal and explicit rechecks keep the page mounted',async()=>{
  const h=harness();h.render();h.requests[0].resolve({enabled:false});await settle();h.render();
  h.refresh();h.render();assert.equal(h.render().props.children[0],'chat-page');assert.equal(h.requests.length,2);
  h.requests[1].reject(new Error('offline'));await settle();h.render();
  h.recheck();assert.equal(h.render().props.children[0],'chat-page');assert.equal(h.requests.length,3);
});
test('a different account does not reuse the previous account security policy',async()=>{
  const h=harness();h.render();h.requests[0].resolve({enabled:false});await settle();h.render();
  h.switchAccount();h.render();assert.ok(restoring(h.render()));
  h.requests[1].resolve({enabled:true});await settle();assert.notEqual(h.render().props.children?.[0],'chat-page');
});
test('a newly enabled lock is enforced without replacing it with a loading screen',async()=>{
  const h=harness(true);h.render();h.requests[0].resolve({enabled:false});await settle();h.render();
  h.update({enabled:true});const view=h.render();assert.equal(restoring(view),false);assert.notEqual(view.props.children?.[0],'chat-page');
});
