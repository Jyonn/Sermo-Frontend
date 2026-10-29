import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bridgeReply,displayURL,trustedReply} from '../src/lib/chronelleBridge.ts';
const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('OAuth iframe accepts exact approved providers and v2 replies only',()=>{
  assert.ok(displayURL('https://chronelle.6-79.cn/oauth/embed/coapp_test_application_123456/'));
  for(const url of ['https://evil.example/oauth/embed/coapp_test_application_123456/','https://chronelle.6-79.cn/binding-embed/123/','https://chronelle.6-79.cn/oauth/embed/coapp_test_application_123456/?token=secret'])assert.equal(displayURL(url),null);
  const reply={protocol:'chronelle.calendar',version:2,type:'state',channel:'channel',request_id:'request',payload:{state:'authorization-expired'}};
  assert.ok(bridgeReply(reply,'channel','request'));
  assert.equal(bridgeReply({...reply,version:1},'channel','request'),null);
  assert.equal(bridgeReply(reply,'channel','stale'),null);
  assert.equal(trustedReply({origin:'https://evil.example',source:1,data:reply},1,'https://chronelle.6-79.cn','channel','request'),null);
});
test('callback is one-shot, strips codes from URL and never persists credentials',()=>{
  const gate=read('components/ChronelleBindingGate.tsx');
  assert.match(gate,/exchanges.get\(callback.state\)/);
  assert.match(gate,/\['code','state','error','error_description'\]/);
  assert.match(gate,/rebind_required/);
  assert.doesNotMatch(gate,/access_token|refresh_token|client_secret/);
  assert.match(gate,/context\.userId!==userId/);
  const frame=read('components/ChronelleFrame.tsx');
  assert.match(frame,/version:2/);assert.match(frame,/tokens:latest.current.tokens/);
  assert.doesNotMatch(frame,/display_ids|localStorage|sessionStorage/);
});
