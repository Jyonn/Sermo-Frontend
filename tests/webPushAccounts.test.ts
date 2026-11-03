import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let user={space_id:1,user_id:1};
  const key=()=>`${user.space_id}:${user.user_id}`;
  const storage=new Map<string,string>();
  const records=new Map<string,Map<string,any>>();
  const rows=()=>{if(!records.has(key()))records.set(key(),new Map());return records.get(key())!;};
  let unsubscribed=0,registrations=0;
  let permission:()=>Promise<string>=async()=>'granted';
  const subscription=(endpoint:string)=>({endpoint,toJSON:()=>({endpoint,keys:{p256dh:'key',auth:'auth'}}),unsubscribe:async()=>{unsubscribed++;}});
  let current:any=subscription('https://push.test/shared');
  const registration={pushManager:{getSubscription:async()=>current,subscribe:async()=>{current=subscription('https://push.test/restored');return current;}}};
  const api={
    getWebPushInfo:async()=>({public_key:'AQID',subscriptions:[...rows().values()].filter(row=>row.enabled&&row.opted_in),bindings:[...rows().values()]}),
    registerWebPush:async(body:any)=>{
      registrations++;
      const current=rows().get(body.endpoint),previous=rows().get(body.previous_endpoint);
      if(body.restore_only&&((current&&!current.opted_in)||!(current||previous?.opted_in)))return current||null;
      if(previous&&previous.endpoint!==body.endpoint){previous.enabled=false;previous.opted_in=false;}
      const row={endpoint:body.endpoint,enabled:true,opted_in:true};rows().set(body.endpoint,row);return row;
    },
    deleteWebPush:async(endpoint:string,previous='')=>{for(const target of [endpoint,previous]){const row=rows().get(target);if(row){row.enabled=false;row.opted_in=false;}}},
  };
  const exports:any={};
  const notification={permission:'granted',requestPermission:()=>permission()};
  const source=readFileSync(new URL('../src/lib/webPush.ts',import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(output,{exports,require:(name:string)=>name==='./api'?{api}:name==='./storage'?{authStorage:{get:()=>({user})}}:{i18n:{t:(key:string)=>key}},
    navigator:{userAgent:'Test',platform:'Test',maxTouchPoints:0,serviceWorker:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}},
    Notification:notification,window:{PushManager:class{},Notification:notification,location:{origin:'https://frienden.jyonn.space'},matchMedia:()=>({matches:true}),atob:(value:string)=>Buffer.from(value,'base64').toString('binary'),localStorage:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}},
  });
  return {push:exports,records,storage,switch:(space:number)=>{user={space_id:space,user_id:1};},rotate:()=>{current=subscription('https://push.test/rotated');},forgetBrowserSubscription:()=>{current=null;},setBrowserPermission:(value:string)=>{notification.permission=value},deferPermission:(fn:()=>Promise<string>)=>{permission=fn;},unsubscribed:()=>unsubscribed,registrations:()=>registrations};
}

test('one shared WebAPP can enable one space account and disable another',async()=>{
  const h=harness();
  await h.push.enableWebPush();
  h.switch(2);
  assert.equal(await h.push.getWebPushState(),'off');
  await h.push.enableWebPush();
  h.switch(1);await h.push.disableWebPush();
  assert.equal(await h.push.getWebPushState(),'off');
  h.switch(2);assert.equal(await h.push.getWebPushState(),'on');
  assert.equal(h.unsubscribed(),0);
  h.switch(1);await h.push.reconcileWebPushSubscription();
  h.storage.clear();
  assert.equal(await h.push.getWebPushState(),'off');
});
test('rotation restores enabled accounts without reviving opted-out accounts',async()=>{
  const h=harness();await h.push.enableWebPush();
  h.switch(2);await h.push.enableWebPush();await h.push.disableWebPush();
  h.switch(1);h.rotate();await h.push.reconcileWebPushSubscription();
  assert.equal(await h.push.getWebPushState(),'on');
  h.switch(2);assert.equal(await h.push.getWebPushState(),'off');
  assert.equal(h.records.get('2:1')?.get('https://push.test/shared').opted_in,false);
});
test('OS subscription loss is reported without silently creating another subscription',async()=>{
  const h=harness();await h.push.enableWebPush();h.forgetBrowserSubscription();
  const registrations=h.registrations();
  assert.equal(await h.push.getWebPushState(),'needs-repair');
  await h.push.reconcileWebPushSubscription();
  assert.equal(h.registrations(),registrations);
  await h.push.enableWebPush();
  assert.equal(await h.push.getWebPushState(),'on');
  h.switch(2);assert.equal(await h.push.getWebPushState(),'off');
});
test('terminally invalid endpoints require an explicit reconnect and cannot be revived by checking',async()=>{
  const h=harness();await h.push.enableWebPush();
  const binding=h.records.get('1:1')!.get('https://push.test/shared');binding.enabled=false;binding.invalidated_at=123;
  const registrations=h.registrations();
  assert.equal(await h.push.getWebPushState(),'needs-repair');
  await h.push.reconcileWebPushSubscription();assert.equal(h.registrations(),registrations);
  await h.push.enableWebPush();assert.equal(h.unsubscribed(),1);assert.equal(await h.push.getWebPushState(),'on');
});
test('a user can turn off a lost connection without reconnecting it first',async()=>{
  const h=harness();await h.push.enableWebPush();h.forgetBrowserSubscription();
  await h.push.disableWebPush();assert.equal(await h.push.getWebPushState(),'off');
});
test('status reads do not register or refresh existing subscriptions',async()=>{
  const h=harness();await h.push.enableWebPush();const registrations=h.registrations();
  assert.equal(await h.push.getWebPushState(),'on');assert.equal(await h.push.getWebPushState(),'on');assert.equal(h.registrations(),registrations);
});
test('a stored subscription does not report on when browser permission has been reset',async()=>{
  const h=harness();await h.push.enableWebPush();h.setBrowserPermission('default');
  assert.equal(await h.push.getWebPushState(),'needs-repair');
  h.setBrowserPermission('denied');assert.equal(await h.push.getWebPushState(),'denied');
});
test('switching accounts during the permission prompt never registers the new account',async()=>{
  const h=harness();let resolve!:(permission:string)=>void;
  h.deferPermission(()=>new Promise(done=>{resolve=done;}));
  const pending=h.push.enableWebPush();h.switch(2);resolve('granted');
  await assert.rejects(pending,/webPush.accountChanged/);
  assert.equal(h.registrations(),0);
});
test('disabling after rotation also disables the previous account binding',async()=>{
  const h=harness();await h.push.enableWebPush();h.rotate();
  await h.push.disableWebPush();
  assert.equal(await h.push.getWebPushState(),'off');
  assert.equal(h.records.get('1:1')?.get('https://push.test/shared').opted_in,false);
});
test('push requests cannot retry a mutation under a switched account',()=>{
  const source=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
  const push=source.slice(source.indexOf('  getWebPushInfo('),source.indexOf('  getGestureLockPrefs('));
  assert.equal((push.match(/retryOn401: false/g)||[]).length,3);
});
test('a stale account UI cannot enable notifications for the newly selected account',async()=>{
  const h=harness();h.switch(2);
  await assert.rejects(h.push.enableWebPush('1:1'),/webPush.accountChanged/);
  await assert.rejects(h.push.disableWebPush('1:1'),/webPush.accountChanged/);
  assert.equal(h.registrations(),0);
});
