import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(supported:boolean, getUserMedia: (constraints:unknown)=>Promise<unknown>) {
  const exports:Record<string,any>={};
  const source=fs.readFileSync(new URL('../src/lib/voiceMicrophone.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,DOMException,navigator:{mediaDevices:{getUserMedia}},
    require(id:string){assert.equal(id,'livekit-client');return {isBrowserSupported:()=>supported}},
  });
  return exports.acquireVoiceMicrophone;
}

test('disabled WebRTC is rejected before microphone access or an invitation can start',async()=>{
  let requested=false;
  const acquire=load(false,async()=>{requested=true;return {}});
  await assert.rejects(acquire(),{name:'NotSupportedError'});
  assert.equal(requested,false);
});

test('supported browsers acquire only an audio track and preserve microphone errors',async()=>{
  const media={id:'dedicated-test-stream'};
  const acquire=load(true,async(constraints)=>{
    assert.deepEqual(JSON.parse(JSON.stringify(constraints)),{audio:{echoCancellation:true,noiseSuppression:true},video:false});
    return media;
  });
  assert.equal(await acquire(),media);
  const denied=load(true,async()=>{throw new DOMException('Denied','NotAllowedError')});
  await assert.rejects(denied(),{name:'NotAllowedError'});
});
