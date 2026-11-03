import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {SITE_ORIGINS} from '../src/lib/siteOrigins.ts';
import {parseFrontendReleaseCatalog} from '../src/lib/frontendReleaseCatalog.ts';

const release={id:'2026.11.03.2',publishedAt:'2026-11-03',locales:{en:{title:'Update',items:['Updated']},'zh-CN':{title:'更新',items:['改进']}}};
const catalog=()=>({kind:'frontend',sources:SITE_ORIGINS.map(site=>({...site,status:'ok',releaseId:release.id,release}))});
test('only frontend catalogs and matching known-origin release records are accepted',()=>{
  assert.equal(parseFrontendReleaseCatalog(catalog()).length,4);
  assert.throws(()=>parseFrontendReleaseCatalog({...catalog(),kind:'backend'}));
  const bad=catalog();bad.sources[0].releaseId='2026.11.03.9';assert.throws(()=>parseFrontendReleaseCatalog(bad));
  assert.throws(()=>parseFrontendReleaseCatalog({kind:'frontend',sources:[]}));
});
function harness(){
  const calls:string[]=[],reloaded:string[]=[],exports:Record<string,any>={};let registrations=0,fail=false;
  const source=readFileSync(new URL('../src/lib/pwaUpdate.ts',import.meta.url),'utf8');
  const current={...release,id:'2026.11.03.1'};
  const location={origin:SITE_ORIGINS[0].origin,href:`${SITE_ORIGINS[0].origin}/demo/app/chats`,replace:(url:string)=>reloaded.push(url)};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,URL,Response,AbortController,setTimeout,clearTimeout,
    fetch:async(url:string)=>{calls.push(String(url));if(fail)throw Error('offline');if(String(url)==='https://api.test/frontend/releases')return new Response(JSON.stringify({body:catalog()}));if(String(url).includes('/index.html'))return new Response('<html/>');return new Response('export {}',{headers:{'Content-Type':'application/javascript'}})},
    window:{location,setTimeout,clearTimeout,sessionStorage:{setItem(){}}},
    navigator:{onLine:true,serviceWorker:{getRegistration:async()=>{registrations++;return undefined}}},
    DOMParser:class{parseFromString(){return{querySelector:()=>({getAttribute:()=>release.id}),querySelectorAll:()=>[{tagName:'SCRIPT',getAttribute:(name:string)=>name==='src'?'/assets/new.js':null}]}}},
    require:(name:string)=>{
      if(name.includes('release-notes'))return{default:current};
      if(name.includes('siteOrigins'))return{SITE_ORIGINS};
      if(name.includes('siteConfig'))return{API_BASE_URL:'https://api.test'};
      if(name.includes('frontendReleaseCatalog'))return{parseFrontendReleaseCatalog};
      if(name.includes('updateDiagnostics'))return{beginUpdate(){},recordUpdate(){},failUpdate(){},markUpdateReload(){},reconcileUpdate(){},compareVersions:(a:string,b:string)=>a.localeCompare(b,undefined,{numeric:true})};
      throw Error(name);
    },
  });
  return{exports,calls,reloaded,registrations:()=>registrations,setFail:()=>{fail=true}};
}
test('version polling is a single API request and never queries workers or reloads',async()=>{
  const h=harness();
  const [a,b]=await Promise.all([h.exports.checkForPwaUpdate(),h.exports.checkForPwaUpdate()]);
  assert.equal(a.latestVersion,release.id);assert.equal(b.updateAvailable,true);
  assert.deepEqual(h.calls,['https://api.test/frontend/releases']);assert.equal(h.registrations(),0);assert.equal(h.reloaded.length,0);
  h.setFail();const failed=await h.exports.checkForPwaUpdate();assert.equal(failed.catalogUnavailable,true);assert.equal(failed.updateAvailable,true);assert.equal(h.reloaded.length,0);
});
test('only explicit update activation verifies current-site resources and reloads once',async()=>{
  const h=harness();await h.exports.checkForPwaUpdate();assert.equal(h.reloaded.length,0);
  await h.exports.activatePwaUpdate();
  assert.equal(h.registrations(),1);assert.equal(h.reloaded.length,1);
  assert.match(h.reloaded[0],/frienden_updated=2026.11.03.2/);
  assert.ok(h.calls.some(url=>url.includes('/index.html')));assert.ok(h.calls.every(url=>!url.includes('release.json')&&!url.includes('sw-release')));
});
test('stable worker activation preserves avatar and unrelated caches without navigating clients',async()=>{
  const listeners:Record<string,any>={},deleted:string[]=[];let skipped=0,claimed=0;
  const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/importScripts\(.*sw-release/);
  vm.runInNewContext(source,{URL,Request,Response,Set,Date,self:{location:{origin:SITE_ORIGINS[0].origin},addEventListener:(key:string,fn:any)=>{listeners[key]=fn},skipWaiting:()=>{skipped++},clients:{claim:async()=>{claimed++}}},caches:{keys:async()=>['sermo-shell-v11','sermo-shell-v12','sermo-avatar-v1','other-app-cache'],delete:async(key:string)=>{deleted.push(key)}}});
  let work:Promise<unknown>;listeners.activate({waitUntil:(promise:Promise<unknown>)=>{work=promise}});await work!;
  assert.deepEqual(deleted,['sermo-shell-v11']);assert.equal(skipped,0);assert.equal(claimed,1);
});
