import test from 'node:test';
import assert from 'node:assert/strict';
import { displayURL,bridgeReply,trustedReply } from './embed-bridge.ts';
const id='35c6deab-103d-4f60-9cf9-9f42c812cc5a';
const message=(type:string,payload:object)=>({protocol:'chronelle.calendar',version:1,type,channel:'test-channel-123456',request_id:'request',payload});
test('display URLs accept only official or isolated loopback shells without credentials',()=>{
  assert.ok(displayURL(`https://chronelle.jyonn.space/binding-embed/${id}/`));
  assert.ok(displayURL(`http://127.0.0.1:9999/binding-embed/${id}/`));
  for(const value of [`https://evil.test/binding-embed/${id}/`,`https://chronelle.jyonn.space/binding-embed/${id}/?token=x`,`https://x:y@chronelle.jyonn.space/binding-embed/${id}/`,`https://chronelle.jyonn.space/#/share/${id}`])assert.equal(displayURL(value),null);
});
test('replies must match protocol, version, channel and latest request',()=>{
  const valid=message('state',{state:'ready',coverage:'partial',availability:'unknown'});
  assert.ok(bridgeReply(valid,valid.channel,'request'));
  for(const patch of [{version:2},{protocol:'other'},{channel:'old'},{request_id:'old'},{type:'write-event'},{payload:{state:'free'}}])assert.equal(bridgeReply({...valid,...patch},valid.channel,'request'),null);
});
test('range preserves duration and requires absolute valid times and timezone',()=>{
  const range={all_day:false,start:'2026-10-27T01:30:00Z',end:'2026-10-27T03:00:00Z',timezone:'Asia/Shanghai'};
  assert.deepEqual(bridgeReply(message('range-selected',range),'test-channel-123456','request'),{type:'range-selected',payload:{start:range.start,end:range.end,timezone:range.timezone}});
  for(const patch of [{end:range.start},{start:'bad'},{timezone:'Invalid/Timezone'},{all_day:true},{end:'2026-10-29T01:30:00Z'}])assert.equal(bridgeReply(message('range-selected',{...range,...patch}),'test-channel-123456','request'),null);
});
test('foreign origin and source window never reach the protocol receiver',()=>{
  const source={},data=message('state',{state:'ready'}),event={origin:'https://chronelle.jyonn.space',source,data};
  assert.ok(trustedReply(event,source,event.origin,'test-channel-123456','request'));
  assert.equal(trustedReply({...event,origin:'https://evil.test'},source,event.origin,'test-channel-123456','request'),null);
  assert.equal(trustedReply({...event,source:{}},source,event.origin,'test-channel-123456','request'),null);
  assert.equal(trustedReply({...event,source:null},null,event.origin,'test-channel-123456','request'),null);
});
