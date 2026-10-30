import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourcePath, visibleResources, formatResourceSize, resourceHost, resourceFileLabel } from '../src/lib/researchResources.ts';

const folder=(id:number,parent_id:number|null)=>({id,parent_id,kind:'folder' as const,name:`Folder ${id}`,size:null,creator_id:1,created_at:'2026-10-29',can_delete:true});
test('resource navigation preserves the two-level path and handles root',()=>{
  const items=[folder(1,null),folder(2,1),folder(3,null)];
  assert.deepEqual(resourcePath(items,null),[]);
  assert.deepEqual(resourcePath(items,2).map(item=>item.id),[1,2]);
  assert.deepEqual(resourcePath(items,3).map(item=>item.id),[3]);
  assert.deepEqual(resourcePath(items,99),[]);
});
test('resource navigation terminates safely for malformed cycles',()=>{
  assert.equal(resourcePath([folder(1,2),folder(2,1)],1).length,2);
});
test('library filters within folders and searches across folder boundaries without mutating input',()=>{
  const items=[folder(1,null),{...folder(2,1),kind:'link' as const,name:'Research notes',url:'https://example.com/paper'},{...folder(3,null),kind:'file' as const,name:'Report.pdf'}];
  assert.deepEqual(visibleResources(items,null,'','all','recent').map(item=>item.id),[3,1]);
  assert.deepEqual(visibleResources(items,null,'paper','link','name').map(item=>item.id),[2]);
  assert.deepEqual(visibleResources(items,1,'','file','recent'),[]);
  assert.deepEqual(items.map(item=>item.id),[1,2,3]);
});
test('resource metadata formats files and links safely',()=>{
  assert.equal(formatResourceSize(1024),'1 KB');
  assert.equal(formatResourceSize(null),'0 B');
  assert.equal(resourceHost('https://example.com/paper'),'example.com');
  assert.equal(resourceHost('invalid'),'');
  assert.equal(resourceFileLabel('Report.pdf'),'PDF');
});
test('project and task reuse library summaries, and group details use an independent settings section',()=>{
  const page=readFileSync(new URL('../src/pages/ResearchPage.tsx',import.meta.url),'utf8');
  const overview=readFileSync(new URL('../src/components/ResearchWorkspace.tsx',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/components/ResearchChat.tsx',import.meta.url),'utf8');
  assert.match(page,/ResearchResourceSummary/);
  assert.match(overview,/research-team-bar/);
  assert.match(overview,/ResearchResourceSummary/);
  assert.match(chat,/research-chat-project-section/);
  assert.match(chat,/if \(onProjectDetails\) onProjectDetails\(\)/);
  assert.match(page,/busy=\{busy\} onClose=\{\(\)=>\{setConfirm\(null\)/);
});
