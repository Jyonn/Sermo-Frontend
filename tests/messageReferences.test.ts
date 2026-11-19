import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceTypes,researchReferencePath} from '../src/lib/messageReferences.ts';
import {mapChatMessageDTO} from '../src/lib/chatMessageMapper.ts';

test('all reference messages survive chat mapping, including unavailable payloads',()=>{
  for(const [kind,type] of Object.entries(referenceTypes)){
    const message:any={message_id:type,user:{user_id:2,name:'Sender'},type,content:'reference',created_at:1,payload:{kind,unavailable:true,project_id:4,task_id:'task-1',progress_id:'reply-1'}};
    const mapped=mapChatMessageDTO(message,1);
    assert.equal(mapped.kind,kind);assert.equal(mapped.payload?.unavailable,true);
    assert.equal(mapped.payload?.progress_id,'reply-1');
  }
});
test('research links preserve exact task and reply targets without injecting query parameters',()=>{
  const path=researchReferencePath({project_id:12,task_id:'task&a=b',progress_id:'reply #1'});
  const url=new URL(path,'https://frienden.jyonn.space');
  assert.equal(url.pathname,'/app/research');
  assert.deepEqual([...url.searchParams],[['project','12'],['task','task&a=b'],['progress','reply #1']]);
  assert.equal(new URL(researchReferencePath({project_id:1,task_id:'t'}),url).searchParams.has('progress'),false);
});
