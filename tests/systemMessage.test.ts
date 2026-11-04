import test from 'node:test';
import assert from 'node:assert/strict';
import {systemMessageParts} from '../src/lib/systemMessage.ts';
import type {ChatMessage} from '../src/types.ts';
const t=(key:string,values:Record<string,unknown>={})=>({
  'common.me':'我','message.system.footprintsShared':'{{actor}} 已向 {{target}} 公开足迹。','message.system.thisChat':'本会话','bgm.entranceMessage':'{{actor}} 出场',
}[key]??key).replace(/\{\{(\w+)\}\}/g,(_,name)=>String(values[name]));
const message={userId:1,name:'Alice',from:'self',text:'Alice shared their footprint map with this chat',payload:{kind:'system',event:'travel_map_shared',actor_user_id:1}} as ChatMessage;
test('direct footprint messages identify the actual destination for each viewer',()=>{
  const actor=systemMessageParts(message,{viewerId:1,peer:{user_id:2,name:'Bob'}},t).filter(part=>typeof part!=='string');
  assert.deepEqual(actor,[{userId:1,name:'我',self:true},{userId:2,name:'Bob',self:false}]);
  const recipient=systemMessageParts({...message,from:'other'},{viewerId:2,peer:{user_id:1,name:'Alice'}},t).filter(part=>typeof part!=='string');
  assert.deepEqual(recipient,[{userId:1,name:'Alice',self:false},{userId:2,name:'我',self:true}]);
});
test('a literal nickname 我 is not mistaken for the viewer',()=>{
  const parts=systemMessageParts({...message,name:'我',from:'other'},{viewerId:2,peer:{user_id:1,name:'我'}},t).filter(part=>typeof part!=='string');
  assert.equal(parts[0].self,false);assert.equal(parts[1].self,true);
});
test('group footprint messages address the group and generic events resolve member IDs',()=>{
  const group=systemMessageParts(message,{viewerId:1,groupTitle:'科研组'},t);
  assert.ok(group.some(part=>typeof part==='string'&&part.includes('科研组')));
  const generic={...message,payload:{kind:'system',event:'members_invited',reference_text:'<@1> 邀请了 <@2>',reference_users:[{user_id:2,name:'Bob'}]}} as ChatMessage;
  assert.deepEqual(systemMessageParts(generic,{viewerId:2},t).filter(part=>typeof part!=='string'),[{userId:1,name:'Alice',self:false},{userId:2,name:'我',self:true}]);
});
test('legacy actor references are upgraded without guessing other nicknames',()=>{
  const parts=systemMessageParts({...message,text:'Alice 邀请了 我',payload:{kind:'system',actor_name:'Alice'}},{viewerId:1},t);
  assert.deepEqual(parts,[{userId:1,name:'我',self:true},' 邀请了 我']);
});
