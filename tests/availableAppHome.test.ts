import assert from 'node:assert/strict';
import test from 'node:test';
import {availableAppHome} from '../src/lib/availableAppHome.ts';
test('home only selects enabled space features and always has a menu fallback',()=>{
  assert.equal(availableAppHome({chatEnabled:true,squareEnabled:true}),'/app/chats');
  assert.equal(availableAppHome({chatEnabled:true,squareEnabled:false}),'/app/chats');
  assert.equal(availableAppHome({chatEnabled:false,squareEnabled:true}),'/app/square');
  assert.equal(availableAppHome({chatEnabled:false,squareEnabled:false}),'/app/menu');
});
