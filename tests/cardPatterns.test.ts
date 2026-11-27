import assert from 'node:assert/strict';
import test from 'node:test';
import {isLegalPlay} from '../src/lib/cardPatterns.ts';

test('Dou Dizhu selects valid combinations with the same length as the previous play', () => {
  assert.equal(isLegalPlay([4,5],[0,1],'landlord'),true);
  assert.equal(isLegalPlay([4],[0,1],'landlord'),false);
  assert.equal(isLegalPlay([0,4,8,12,16],[4,8,12,16,20],'landlord'),false);
  assert.equal(isLegalPlay([4,8,12,16,20,24],[0,4,8,12,16],'landlord'),false);
  assert.equal(isLegalPlay([0,1,2,4,5,6,12,16],[],'landlord'),true);
  assert.equal(isLegalPlay([0,1,2,3],[52,53],'landlord'),false);
  assert.equal(isLegalPlay([52,53],[0,1,2,3],'landlord'),true);
});

test('Firefight permits wild big jokers and follows star precedence', () => {
  assert.equal(isLegalPlay([0,1,2,3,53],[],'classic'),false);
  assert.equal(isLegalPlay([0,1,2,3,53],[4,5,6,7],'firefight'),true);
  const chain = [0,1,2,3,4,5,6,7,8,9,10,11];
  assert.equal(isLegalPlay(chain,[52,53,106],'firefight'),true);
  assert.equal(isLegalPlay(chain,[52,53,106,107],'firefight'),false);
  assert.equal(isLegalPlay([54,54],[],'firefight'),false);
});
