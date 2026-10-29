import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextOverlayLevel} from '../src/lib/overlayOrder.ts';
test('sheets open above floating drawers rather than retaining the old CSS rank',()=>{
  const drawer=nextOverlayLevel(31,[]);
  const sheet=nextOverlayLevel(30,[drawer]);
  const child=nextOverlayLevel(31,[drawer,sheet]);
  assert.ok(sheet>drawer);assert.ok(child>sheet);assert.ok(child-1>sheet);
});
test('specialized media surfaces retain their base while new children open above them',()=>{
  assert.equal(nextOverlayLevel(5000,[100]),5000);
  assert.ok(nextOverlayLevel(30,[5000])>5000);
  assert.ok(nextOverlayLevel(60,[31000])>31000);
});
test('closed layers do not cause unbounded growth and invalid CSS levels are ignored',()=>{
  assert.equal(nextOverlayLevel(30,[]),100);
  assert.equal(nextOverlayLevel(NaN,[NaN,Infinity]),100);
});
test('all focus-managed dialogs and both floating drawer paths use the same allocator',()=>{
  const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
  assert.match(read('lib/modalFocus.ts'),/useOverlayLayer\(root,open/);
  assert.match(read('components/SideDrawer.tsx'),/panels\?\.floating&&panels.topId===drawerId/);
  assert.match(read('components/SideDrawer.tsx'),/zIndex:overlayLevel-1/);
  assert.match(read('lib/overlayLayer.ts'),/node.dataset.overlayOwner!==owner/);
});
