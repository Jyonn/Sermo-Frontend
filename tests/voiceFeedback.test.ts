import assert from 'node:assert/strict';
import test from 'node:test';
import {voiceFeedbackSurface} from '../src/lib/voiceFeedback.ts';

test('eligibility, allowance and microphone decisions remain in a modal',()=>{
  for(const reason of ['vip_required','quota_empty','peer_quota_empty','phone_required','microphone','forbidden'])assert.equal(voiceFeedbackSurface(reason),'modal');
});
test('transient failures do not interrupt the conversation with a sheet',()=>{
  for(const reason of ['busy','network','expired','other_device','unavailable','same_person'])assert.equal(voiceFeedbackSurface(reason),'toast');
});
