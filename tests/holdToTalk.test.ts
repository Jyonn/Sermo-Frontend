import test from 'node:test';
import assert from 'node:assert/strict';
import { HoldToTalkRecorder, holdGesture } from '../src/lib/holdToTalk.ts';

function fixture() {
  let now=0,cleaned=0,created=0;
  const sent:Blob[]=[];const errors:unknown[]=[];
  const states:string[]=[];
  const recorder={state:'inactive',mimeType:'audio/webm',ondataavailable:null as null|((e:{data:Blob})=>void),onstop:null as null|(()=>void),start(){this.state='recording';},stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'])});this.onstop?.();}};
  const capture={stream:{} as MediaStream,analyser:null,cleanup(){cleaned++;}};
  const options={capture:async()=>capture,recorder:()=>{created++;return recorder as unknown as MediaRecorder;},now:()=>now,onState:(state:{phase:string})=>states.push(state.phase),onRecorded:(blob:Blob)=>sent.push(blob),onError:(error:unknown)=>errors.push(error)};
  return {options,recorder,capture,sent,errors,states,advance:(ms:number)=>{now+=ms;},cleaned:()=>cleaned,created:()=>created};
}
test('hold gestures match chat slide and cancel thresholds',()=>{
  assert.equal(holdGesture(700,695,844,false),'recording');
  assert.equal(holdGesture(700,660,844,false),'sliding');
  assert.equal(holdGesture(700,460,844,true),'cancel');
  assert.equal(holdGesture(700,680,844,true),'sliding');
});
test('release sends one valid recording and releases microphone resources',async()=>{
  const f=fixture();const controller=new HoldToTalkRecorder(f.options);
  await controller.start();f.advance(1000);const stale=f.recorder.onstop;
  controller.stop();controller.stop();stale?.();
  assert.equal(f.sent.length,1);assert.equal(f.cleaned(),1);assert.equal(f.errors.length,0);
  controller.cancel();
});
test('cancel never sends audio, including delayed stop callbacks',async()=>{
  const f=fixture();const controller=new HoldToTalkRecorder(f.options);
  await controller.start();f.advance(1000);const stale=f.recorder.onstop;
  controller.cancel();stale?.();assert.equal(f.sent.length,0);assert.equal(f.cleaned(),1);
});
test('release or cancellation before microphone permission resolves cannot send later',async()=>{
  for (const cancel of [false,true]) {
    const f=fixture();let resolve!: (capture:typeof f.capture)=>void;
    const pending=new Promise<typeof f.capture>(done=>{resolve=done;});
    const controller=new HoldToTalkRecorder({...f.options,capture:()=>pending});
    const start=controller.start();if(cancel)controller.cancel();else controller.stop();
    resolve(f.capture);await start;
    assert.equal(f.sent.length,0);assert.equal(f.created(),0);assert.equal(f.cleaned(),1);
  }
});
test('too-short recordings and denied microphone access never produce messages',async()=>{
  const f=fixture();const controller=new HoldToTalkRecorder(f.options);
  await controller.start();f.advance(100);controller.stop();assert.equal(f.sent.length,0);assert.equal(f.errors.length,1);
  const denied=new HoldToTalkRecorder({...f.options,capture:async()=>{throw Error('denied');}});
  await denied.start();assert.equal(f.errors.length,2);assert.equal(f.sent.length,0);denied.cancel();
});
