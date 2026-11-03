import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

async function dispatch({visible=true,payload={title:'Hello',body:'Message',receipt_token:'signed'},failures=0,offline=false}:{visible?:boolean;payload?:any;failures?:number;offline?:boolean}={}){
  const handlers:any={},shown:any[]=[],receipts:any[]=[];let work:Promise<any>|undefined,clientLookups=0;
  const self={location:{origin:'https://frienden.jyonn.space'},addEventListener:(type:string,fn:Function)=>handlers[type]=fn,
    clients:{matchAll:async()=>{clientLookups++;return [{visibilityState:visible?'visible':'hidden'}]}},
    registration:{showNotification:async(title:string,options:any)=>{shown.push({title,options});if(failures-->0)throw Object.assign(new Error('denied'),{name:'NotAllowedError'})}},
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
    self,URL,AbortController,setTimeout:()=>1,clearTimeout:()=>{},fetch:async(url:string,options:any)=>{receipts.push({url,...JSON.parse(options.body),credentials:options.credentials});if(offline)throw Error('offline');return {ok:true}},
  });
  handlers.push({data:{json:()=>payload},waitUntil:(promise:Promise<any>)=>{work=promise}});await work;
  return {shown,receipts,clientLookups};
}
test('push always submits a system notification, including with a foreground page',async()=>{
  for(const visible of [true,false]){const h=await dispatch({visible});assert.equal(h.shown.length,1);assert.equal(h.clientLookups,0);assert.deepEqual(h.receipts.map(item=>item.phase),['received','submitted']);assert.equal(h.receipts[0].credentials,'omit')}
});
test('receipt network failures never prevent a system notification',async()=>{
  const h=await dispatch({offline:true});assert.equal(h.shown.length,1);assert.equal(h.receipts.at(-1).phase,'submitted');
});
test('notification decoration failures retry with minimal options',async()=>{
  const h=await dispatch({failures:1});assert.equal(h.shown.length,2);assert.equal(h.shown[1].options.icon,undefined);assert.equal(h.receipts.at(-1).phase,'submitted');
});
test('system permission failures are reported separately from server acceptance',async()=>{
  const h=await dispatch({failures:2});assert.equal(h.receipts.at(-1).phase,'failed');assert.equal(h.receipts.at(-1).error,'NotAllowedError');
});
test('old and null payloads remain visible without requiring receipt support',async()=>{
  const old=await dispatch({payload:{body:'Legacy'}});assert.equal(old.shown.length,1);assert.equal(old.receipts.length,0);
  const empty=await dispatch({payload:null});assert.equal(empty.shown.length,1);assert.ok(empty.shown[0].options.body);
});
