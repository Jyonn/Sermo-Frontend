import test from 'node:test';
import assert from 'node:assert/strict';
import {claimMediaPlayback,releaseMediaPlayback} from '../src/lib/mediaPlaybackFocus.ts';
test('taking audio focus pauses the previous player and releasing an old clip keeps current playback intact',()=>{
 let firstPauses=0,secondPauses=0;
 const first={pause:()=>firstPauses++} as HTMLMediaElement,second={pause:()=>secondPauses++} as HTMLMediaElement;
 claimMediaPlayback(first);claimMediaPlayback(first);assert.equal(firstPauses,0);
 claimMediaPlayback(second);assert.equal(firstPauses,1);
 releaseMediaPlayback(first);claimMediaPlayback(first);assert.equal(secondPauses,1);
 releaseMediaPlayback(first);claimMediaPlayback(second);assert.equal(firstPauses,1);releaseMediaPlayback(second);
});
