import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
test('guidance waits for server state and remains visible until acknowledged, including configured calls',()=>{
  const exports:Record<string,any>={};
  const state={ready:false,callHintSeen:false,acknowledgeCallHint:()=>{state.callHintSeen=true}};
  let session:any={user:{space_id:1,user_id:7}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/callShortcutDiscovery.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require(id:string){
      if(id==='./auth')return {useAuth:()=>({session})};
      if(id==='./useChatQuickActions')return {useChatQuickActions:()=>state};
      if(id==='./voiceCalls')return {voiceCallsEnabled:true};
      if(id==='./language')return {useI18n:()=>({t:(key:string)=>key})};
      return require(id);
    },
  });
  assert.equal(exports.useCallShortcutDiscovery().pending,false);
  state.ready=true;
  assert.equal(exports.useCallShortcutDiscovery().pending,true);
  exports.useCallShortcutDiscovery().acknowledge();
  assert.equal(exports.useCallShortcutDiscovery().pending,false);
  state.callHintSeen=false;session=null;
  assert.equal(exports.useCallShortcutDiscovery().pending,false);
});
