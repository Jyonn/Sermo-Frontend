import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signaturePresets, SIGNATURE_MAX_LENGTH } from '../src/lib/signature.ts';
test('the six requested signature presets are preserved verbatim and fit the limit',()=>{
  assert.deepEqual(signaturePresets,['我可以道歉，但你必须跪着听。','理想主义青年永远不会被现实招安。','人间忽晚，山河已秋。','总之岁月漫长，然而值得等待。','近朱者赤，近你者甜。','风铃垭口，时光年迈，拐杖冒出青苔。']);
  assert.ok(signaturePresets.every(text=>Array.from(text).length<=SIGNATURE_MAX_LENGTH));
});
test('both conversation headers use the shared identity and retain presence separately from the signature',()=>{
  const page=readFileSync(new URL('../src/pages/ChatsPage.tsx',import.meta.url),'utf8');
  assert.equal((page.match(/<ChatConversationIdentity chat=/g)||[]).length,2);
  assert.match(page,/signature: chat.group \? '' : peer\?\.signature/);
  const component=readFileSync(new URL('../src/components/ChatConversationIdentity.tsx',import.meta.url),'utf8');
  assert.match(component,/chat\.signature/);assert.match(component,/chat-inline-presence/);assert.match(component,/groupMembers=/);
  const css=readFileSync(new URL('../src/components/ChatConversationIdentity.css',import.meta.url),'utf8');
  assert.match(css,/@media\(min-width:901px\)/);
  assert.match(css,/\.chat-identity-avatar\{display:none\}/);
  assert.match(css,/text-overflow:ellipsis/);
});
