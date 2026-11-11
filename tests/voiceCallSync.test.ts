import assert from 'node:assert/strict';
import test from 'node:test';
import {newestChatActivity} from '../src/lib/chatSync.ts';
import {mapChatMessageDTO} from '../src/lib/chatMessageMapper.ts';

const item=(id:number,created:number,updated=false)=>({chatId:1,updated,message:mapChatMessageDTO({message_id:id,type:14,created_at:created,content:'Voice call',user:{user_id:2,name:'Peer'},payload:{kind:'voice_call',call_id:'call-one',chat_id:1,state:'ended',duration_seconds:8}},1)});
test('call status updates keep message identity and cannot reorder the conversation list',()=>{
  const update=item(10,100,true);
  assert.equal(update.message.id,10);
  assert.equal(update.message.kind,'voice_call');
  assert.equal(update.message.payload?.duration_seconds,8);
  assert.equal(newestChatActivity([update],99),undefined);
  assert.equal(newestChatActivity([update],200),undefined);
});
test('new messages advance activity while older sync batches do not',()=>{
  assert.equal(newestChatActivity([item(10,100),item(11,300)],200)?.id,11);
  assert.equal(newestChatActivity([item(10,100)],200),undefined);
});
