import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8');
test('resource drops are guarded by write permissions and serialize uploads',()=>{
  const source=read('components/ResearchResources.tsx');
  assert.match(source,/uploadQueue.current\|\|busy\|\|!space\?\.writable/);
  assert.match(source,/for\(const file of files\)\{if\(!await upload\(file\)\)break;/);
  assert.match(source,/onDrop=\{event=>\{event.preventDefault\(\)/);
  assert.match(source,/Array.from\(event.dataTransfer.files\)/);
  assert.match(source,/<ActionSheet compactHeader open=\{addMenu\}/);
});
test('chat and resource drop hints share theme-aware surfaces',()=>{
  assert.match(read('pages/ChatsPage.tsx'),/<FileDropGuide\/>/);
  assert.match(read('components/ResearchResources.tsx'),/<FileDropGuide resource\/>/);
  const css=read('styles/app/10-chat-city.css');
  const drop=css.slice(css.indexOf('.chat-file-drop-guide {'),css.indexOf('@keyframes chat-file-drop-enter'));
  assert.doesNotMatch(drop,/surface-primary|#fffdf8/);
  assert.match(css,/\.chat-clipboard-item \{[^}]*background: var\(--bg-elevated\)/s);
});
test('shared mobile and desktop navigation puts Research immediately before Contacts',()=>{
  const source=read('components/AppBottomNav.tsx');
  assert.match(source,/key: "research"[^\n]*\n\s*\{ key: "notifications"/);
});
