import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveTranscription} from '../src/lib/liveTranscription.ts';
import {voiceDropGesture} from '../src/lib/holdToTalk.ts';
import vm from 'node:vm';
import fs from 'node:fs';

class Socket {
  readyState=1;bufferedAmount=0;sent:(string|ArrayBuffer)[]=[];
  listeners:Record<string,((data:any)=>void)[]>={};
  addEventListener(name:string,fn:(data:any)=>void){(this.listeners[name]??=[]).push(fn);}
  send(value:string|ArrayBuffer){this.sent.push(value);}
  close(){this.readyState=3;this.emit('close',{});}
  emit(name:string,data:any){this.listeners[name]?.forEach(fn=>fn(data));}
  message(data:any){this.emit('message',{data:JSON.stringify(data)});}
}
async function fixture(){const updates:any[]=[];const session=new LiveTranscription(value=>updates.push(value));const socket=new Socket();session.connect(async()=>({ticket:'test-ticket'}),'wss://test',()=>socket);await Promise.resolve();socket.emit('open',{});return {session,socket,updates};}
test('queues PCM until ready, streams partials and waits for final sentence after finish',async()=>{
  const {session,socket,updates}=await fixture();
  session.push(new ArrayBuffer(3200));assert.equal(socket.sent.length,1);
  socket.message({type:'ready'});assert.equal(socket.sent.length,2);
  socket.message({type:'transcript',text:'你好',final_text:'',partial_text:'你好'});
  const result=session.finish();assert.match(String(socket.sent.at(-1)),/finish/);
  socket.message({type:'done',text:'你好，明天见。'});
  assert.deepEqual(await result,{ok:true,text:'你好，明天见。'});
  assert.equal(updates.at(-1).status,'complete');assert.equal(socket.readyState,3);
});
test('failure retains recognized text, cancellation drops late callbacks and bounded queue fails safely',async()=>{
  const {session,socket}=await fixture();socket.message({type:'ready'});
  socket.message({type:'transcript',text:'partial',partial_text:'partial'});socket.emit('error',{});
  assert.deepEqual(await session.finish(),{ok:false,text:'partial'});
  const next=await fixture();next.session.cancel();next.socket.message({type:'done',text:'late'});assert.equal(next.updates.length,0);
  const over=await fixture();over.session.push(new ArrayBuffer(512002));assert.equal((await over.session.finish()).ok,false);
});
test('cancel while grant pending never connects later',async()=>{
  let resolve!:(value:{ticket:string})=>void;let created=0;
  const session=new LiveTranscription(()=>{});session.connect(()=>new Promise(done=>{resolve=done;}),'wss://test',()=>{created++;return new Socket();});
  session.cancel();resolve({ticket:'late'});await Promise.resolve();assert.equal(created,0);
});
test('gesture returns to voice when moved back; left cancels and right converts',()=>{
  const bounds={left:20,right:370,top:360,bottom:470};
  assert.equal(voiceDropGesture(730,50,450,bounds),'cancel');
  assert.equal(voiceDropGesture(730,330,450,bounds),'text');
  assert.equal(voiceDropGesture(730,330,600,bounds),'sliding');
  assert.equal(voiceDropGesture(730,330,720,bounds),'recording');
  const landscape={left:640,right:820,top:100,bottom:210};
  assert.equal(voiceDropGesture(350,680,150,landscape),'cancel');
  assert.equal(voiceDropGesture(350,790,150,landscape),'text');
});
test('AudioWorklet resamples 44.1/48k to exactly 16k mono PCM and flushes tail',()=>{
  for(const sampleRate of [44100,48000]){
    let Processor:any;const chunks:ArrayBuffer[]=[];const events:any[]=[];
    class Base {port={onmessage:null as any,postMessage:(data:any)=>{if(typeof data==='string')events.push(data);else chunks.push(data);}};}
    vm.runInNewContext(fs.readFileSync(new URL('../src/lib/liveVoice.worklet.js',import.meta.url),'utf8'),{AudioWorkletProcessor:Base,sampleRate,registerProcessor:(_name:string,value:any)=>{Processor=value;},ArrayBuffer,DataView,Math});
    const processor=new Processor();
    for(let n=0;n<sampleRate;n+=128)processor.process([[new Float32Array(Math.min(128,sampleRate-n)).fill(.5)]]);
    processor.port.onmessage({data:'stop'});
    assert.equal(chunks.reduce((size,chunk)=>size+chunk.byteLength,0),32000);
    assert.deepEqual(events,['stopped']);
  }
});
