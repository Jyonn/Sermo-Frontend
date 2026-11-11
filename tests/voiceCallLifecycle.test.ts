import assert from 'node:assert/strict';
import test from 'node:test';
import {endVoiceCallMedia} from '../src/lib/voiceCallLifecycle.ts';

test('hangup silences audio immediately and disconnects only after server settlement',async()=>{
  const events:string[]=[];
  let resolve!:(value:string)=>void;
  const settled=new Promise<string>(done=>{resolve=done});
  const ending=endVoiceCallMedia(()=>events.push('mute'),()=>{events.push('request');return settled},()=>events.push('disconnect'));
  assert.deepEqual(events,['mute','request']);
  resolve('completed');
  assert.equal(await ending,'completed');
  assert.deepEqual(events,['mute','request','disconnect']);
});

test('failed settlement still releases media and preserves the error',async()=>{
  let released=false;
  const error=new Error('unavailable');
  await assert.rejects(endVoiceCallMedia(()=>{},async()=>{throw error},()=>{released=true}),error);
  assert.equal(released,true);
});
