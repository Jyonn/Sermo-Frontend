import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/pages/ResearchPage.css',import.meta.url),'utf8');
test('embedded chat leaves the outer Drawer as the only rounded surface',()=>{
  const wrapper=css.match(/\.research-embedded-chat>\.chat-mobile-layout\{([^}]+)\}/)![1];
  for(const rule of ['border:0','border-radius:0','background:transparent','box-shadow:none'])assert.ok(wrapper.includes(rule));
  assert.match(css,/research-embedded-chat>\.chat-mobile-layout>\.chat-main-pane\{[^}]*border-radius:0/);
});
test('mobile embedded headers include safe areas without adding duplicate message padding',()=>{
  assert.match(css,/@media\(max-width:719px\)\{[^\n]*desktop-conversation-header\{[^}]*min-height:64px/);
  for(const side of ['top','right','left'])assert.ok(css.includes(`safe-area-inset-${side}`));
  assert.match(css,/@media\(max-width:719px\) and \(max-height:500px\)/);
  assert.doesNotMatch(css,/research-embedded-chat \.message-scroll\{[^}]*padding/);
});
