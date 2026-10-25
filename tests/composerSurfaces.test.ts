import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
test('welcome and broadcast share the modern draft field and an explicit send button',()=>{
  for(const path of ['components/WelcomeMessageEditor.tsx','pages/SpaceAdminDashboardPage.tsx']) {
    assert.match(read(path),/<ChatComposerTextRow/);
    assert.match(read(path),/canSend=\{Boolean\(/);
  }
  const row=read('components/ChatComposerTextRow.tsx');
  assert.match(row,/disabled=\{disabled \|\| !canSend\}/);
  assert.match(row,/type="submit"/);
  assert.match(read('components/WelcomeMessageEditor.tsx'),/return <SideDrawer\s+fullscreen/);
});
test('voice opens inside the conversation instead of overflowing its left edge',()=>{
  const css=read('styles/app/70-square-composer.css');
  assert.match(css,/\.desktop-tool-popover\.is-voice \{ right:auto;left:0/);
  assert.match(css,/\.desktop-writing-desk-toolbar \{\s+position: relative;\s+z-index: 6/);
  assert.doesNotMatch(css,/right: -44px/);
});
