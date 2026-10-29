import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('online avatar indicators escape the outer silhouette while images remain clipped',()=>{
  const css=read('src/styles/app/35-avatar-frames.css');
  assert.match(css,/\.user-avatar\.status-online\s*\{ overflow: visible; \}/);
  assert.match(css,/\.user-avatar\.status-online::after\s*\{ z-index: 2; \}/);
  assert.match(css,/\.avatar-frame-clip\s*\{[^}]*overflow: hidden;/);
});
test('comment spans cannot push badges away from names',()=>{
  assert.doesNotMatch(read('src/styles/app/39-personalization-tools.css'),/\.square-comment-list header span\s*\{/);
  assert.match(read('src/styles/app/40-square-platform.css'),/\.square-comment-more\{[^}]*margin:0 0 0 auto/);
});
test('quota windows share a compact row and unlimited quotas hide empty meters',()=>{
  const css=read('src/components/SquareExperience.css');
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.square-quota-windows>\.is-unlimited \.square-quota-meter \{ display:none; \}/);
  assert.match(read('src/pages/SquarePage.tsx'),/window.limit === null \? "is-unlimited"/);
});
test('sidebar uses directional chevrons and retains expanded-state rotation',()=>{
  assert.match(read('src/components/AppBottomNav.tsx'),/m11 7-5 5 5 5M18 7l-5 5 5 5/);
  assert.match(read('src/styles/app/10-chat-city.css'),/desktop-nav-toggle svg\s*\{\s*transform: rotate\(180deg\)/);
});
