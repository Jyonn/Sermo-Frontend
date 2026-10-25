import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
test('welcome and broadcast reuse real chat desktop and mobile composer layouts',()=>{
  for(const path of ['components/WelcomeMessageEditor.tsx','pages/SpaceAdminDashboardPage.tsx']) {
    assert.match(read(path),/<ChatComposerLayout/);
    assert.match(read(path),/<MentionComposerInput/);
    assert.match(read(path),/useMobileComposerLayout\(\)/);
    assert.doesNotMatch(read(path),/message-draft|<ChatComposerTextRow/);
  }
  const row=read('components/ChatComposerLayout.tsx');
  assert.match(row,/<DesktopChatComposerDesk/);
  assert.match(row,/<MobileChatComposer/);
  assert.match(row,/mobile-quiet-input-wrap/);
  assert.match(read('pages/ChatsPage.tsx'),/<MobileChatComposer/);
  assert.match(read('pages/ChatsPage.tsx'),/<DesktopChatComposerDesk/);
  assert.match(read('components/WelcomeMessageEditor.tsx'),/return <SideDrawer\s+fullscreen/);
});
test('tools use chat icons and respect welcome and broadcast capabilities',()=>{
  const welcome=read('components/WelcomeMessageEditor.tsx');
  const admin=read('pages/SpaceAdminDashboardPage.tsx');
  assert.match(welcome,/<CloudFilePickerSheet/);
  assert.match(welcome,/resource_id: resource.resource_id/);
  for (const source of [welcome,admin]) {
    assert.match(source,/ComposerSvgIcon/);
    assert.doesNotMatch(source,/<ComposerSvgIcon kind="(?:map|location)"/);
  }
  assert.doesNotMatch(admin,/CloudFilePickerSheet|AdminComposerIcon/);
  assert.match(admin,/setBroadcastContent\(value.slice\(0,512\)\)/);
});
test('voice opens inside the conversation instead of overflowing its left edge',()=>{
  const css=read('styles/app/70-square-composer.css');
  assert.match(css,/\.desktop-tool-popover\.is-voice \{ right:auto;left:0/);
  assert.match(css,/\.desktop-writing-desk-toolbar \{\s+position: relative;\s+z-index: 6/);
  assert.doesNotMatch(css,/right: -44px/);
});
