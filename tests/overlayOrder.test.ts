import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextOverlayLevel,orderOverlayEntries} from '../src/lib/overlayOrder.ts';
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
test('responsive portal reparenting does not raise an existing drawer above its child dialog',()=>{
  const drawer=nextOverlayLevel(31,[]);
  const dialog=nextOverlayLevel(60,[drawer]);
  assert.equal(nextOverlayLevel(31,[dialog],drawer),drawer);
  assert.ok(nextOverlayLevel(31,[drawer,dialog])>dialog);
});
test('all focus-managed dialogs and both floating drawer paths use the same allocator',()=>{
  const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
  assert.match(read('lib/modalFocus.ts'),/useOverlayLayer\(root,open/);
  assert.match(read('components/SideDrawer.tsx'),/panels\?\.floating&&panels.topId===drawerId/);
  assert.match(read('components/SideDrawer.tsx'),/zIndex:overlayLevel-1/);
  assert.match(read('lib/overlayLayer.tsx'),/node.dataset.overlayOwner!==owner/);
  assert.match(read('lib/overlayLayer.tsx'),/\.desktop-panel-slot/);
});
test('chat message actions open above research chat drawers',()=>{
  const source=readFileSync(new URL('../src/pages/ChatsPage.tsx',import.meta.url),'utf8');
  assert.match(source,/useOverlayLayer\(messageMenuRef, Boolean\(messageMenu && !messageMenu.confirmDelete\)\)/);
  assert.ok(nextOverlayLevel(70,[nextOverlayLevel(31,[])])>100);
});
test('cold-mounted portal children stay above parents regardless of effect order',()=>{
  const parent={},child={},picker={};
  const rows=[{root:picker,parents:[parent,child],order:1},{root:child,parents:[parent],order:2},{root:parent,parents:[],order:3}];
  assert.deepEqual(orderOverlayEntries(rows).map(row=>row.root),[parent,child,picker]);
});
test('independent openings retain their order while nested parents precede descendants',()=>{
  const first={},second={},child={};
  const rows=[{root:first,parents:[],order:1},{root:second,parents:[],order:2},{root:child,parents:[first],order:3}];
  assert.deepEqual(orderOverlayEntries(rows).map(row=>row.root),[first,second,child]);
  assert.deepEqual(orderOverlayEntries(rows.filter(row=>row.root!==child)).map(row=>row.root),[first,second]);
});
