import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationCategories,notificationTopicLabels} from '../src/lib/notificationCategories.ts';
test('four categories cover each topic once and online belongs to chat',()=>{
  assert.deepEqual(notificationCategories.map(item=>item.id),['chat','square','submission','research']);
  const topics=notificationCategories.flatMap(item=>[...item.topics]);
  assert.equal(new Set(topics).size,11);assert.equal(topics.length,11);
  assert.ok(notificationCategories[0].topics.includes(6));
  for(const topic of topics)assert.ok(notificationTopicLabels[topic]);
});
