import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectResearchProject} from '../src/lib/researchNavigation.ts';
import type {ResearchSummary} from '../src/lib/research';
const projects:ResearchSummary[]=[{id:1,title:'Archived',status:'archived',start:'2026-10-28',end:null},{id:2,title:'Active',status:'active',start:'2026-10-28',end:null}];
test('mobile research header spans the viewport without inherited shell gutters',()=>{
  const css=readFileSync(new URL('../src/pages/ResearchWorkspaceLayout.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:719px\)\{\s*\.shell-no-topbar\.research-workspace-shell\{width:100%;margin-inline:0\}/);
  assert.match(css,/research-direct-workspace>\.tab-sticky-header\{width:100%;margin-inline:0;padding-inline:24px;border-radius:0\}/);
  assert.match(css,/height:100dvh;min-height:0;padding-inline:0/);
});
test('current project resolves remembered selection, active fallback and empty membership',()=>{
  assert.equal(selectResearchProject(projects,1),1);
  assert.equal(selectResearchProject(projects,null),2);
  assert.equal(selectResearchProject(projects,999),2);
  assert.equal(selectResearchProject(projects.slice(0,1),null),1);
  assert.equal(selectResearchProject([],2),null);
});
test('research renders the selected project directly and keeps management in a floating Drawer',()=>{
  const page=readFileSync(new URL('../src/pages/ResearchPage.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(page,/historyKey="research-project"|workspaceSelected=/);
  assert.match(page,/secondary=\{id&&list.length/);
  assert.match(page,/triggerLabel=\{/);
  assert.match(page,/historyKey="research-manage"/);
  assert.match(page,/localStorage.setItem\(memoryKey/);
  assert.doesNotMatch(page,/<p className="research-muted">\{t\('research.shared'\)\}/);
  const comments=readFileSync(new URL('../src/components/ResearchComments.tsx',import.meta.url),'utf8');
  assert.ok(comments.indexOf('research-comments-scroll')<comments.indexOf('{writable&&<CommentComposer'));
  const item=readFileSync(new URL('../src/components/ResearchTaskItem.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(item,/research-task-excerpt/);
});
