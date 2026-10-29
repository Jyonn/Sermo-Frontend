import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationCategories,notificationCategoriesForSpace,notificationTopicLabels} from '../src/lib/notificationCategories.ts';
test('four categories cover each topic once and online belongs to chat',()=>{
  assert.deepEqual(notificationCategories.map(item=>item.id),['chat','square','submission','research']);
  const topics=notificationCategories.flatMap(item=>[...item.topics]);
  assert.equal(new Set(topics).size,11);assert.equal(topics.length,11);
  assert.ok(notificationCategories[0].topics.includes(6));
  for(const topic of topics)assert.ok(notificationTopicLabels[topic]);
});
test('notification categories match every combination of space tab switches',()=>{
  for(let mask=0;mask<16;mask++) {
    const flags=[1,2,4,8].map(bit=>Boolean(mask&bit));
    const features={ready:true,chatEnabled:flags[0],squareEnabled:flags[1],submissionEnabled:flags[2],researchEnabled:flags[3]};
    assert.deepEqual(notificationCategoriesForSpace(features).map(item=>item.id),notificationCategories.filter((_,index)=>flags[index]).map(item=>item.id));
  }
});
test('loading space settings never exposes default or previous-space categories',()=>{
  const features={ready:false,chatEnabled:true,squareEnabled:true,submissionEnabled:true,researchEnabled:true};
  assert.deepEqual(notificationCategoriesForSpace(features),[]);
  assert.deepEqual(notificationCategoriesForSpace({...features,ready:true,researchEnabled:undefined}).map(item=>item.id),['chat','square','submission']);
});
test('filtering does not mutate the full category or topic definitions',()=>{
  notificationCategoriesForSpace({ready:true,chatEnabled:false,squareEnabled:true,submissionEnabled:false,researchEnabled:false});
  assert.equal(notificationCategories.length,4);
  assert.equal(notificationCategories.flatMap(item=>[...item.topics]).length,11);
});
