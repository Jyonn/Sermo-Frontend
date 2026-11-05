import test from 'node:test';
import assert from 'node:assert/strict';
import {initialResearchStudio,taskReadiness,taskEvidence,studioHealth,safeResearchLink} from '../src/lib/researchStudio.ts';
import * as studio from '../src/lib/researchStudio.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('the task line exposes prerequisites until they are accepted',()=>{
  const data=initialResearchStudio(),experiment=data.tasks.find(t=>t.id==='R05')!;
  assert.deepEqual(taskReadiness(experiment,data.tasks).map(t=>t.id),['R03','R04']);
  data.tasks.find(t=>t.id==='R03')!.state='review';
  assert.equal(taskReadiness(experiment,data.tasks).length,2,'submission is not acceptance');
  data.tasks.find(t=>t.id==='R03')!.state='done';
  assert.deepEqual(taskReadiness(experiment,data.tasks).map(t=>t.id),['R04']);
});
test('health distinguishes blockers, review and overdue work without treating review as completion',()=>{
  const data=initialResearchStudio(),health=studioHealth(data.tasks,'2026-11-08');
  assert.equal(health.done,1);assert.equal(health.blocked.length,1);assert.equal(health.review.length,1);
  assert.deepEqual(health.overdue.map(t=>t.id),['R02','R04']);
  assert.deepEqual(taskEvidence(data.tasks.find(t=>t.id==='R03')!),{done:1,total:3});
});
test('fixtures are independent and research artifacts cannot execute code',()=>{
  const first=initialResearchStudio(),second=initialResearchStudio();
  first.tasks[0].criteria[0].done=false;
  assert.equal(second.tasks[0].criteria[0].done,true);
  assert.equal(safeResearchLink('https://example.com/results'),'https://example.com/results');
  for(const invalid of ['javascript:alert(1)','data:text/html,hi','file:///tmp/test','not a link'])assert.equal(safeResearchLink(invalid),null);
});

test('student completes evidence and submits; supervisor accepts in the production design page',()=>{
  const slots:any[]=[],stored=new Map<string,string>();let cursor=0;
  const require=createRequire(import.meta.url),react=require('react'),exports:any={};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/pages/ResearchStudioPage.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,localStorage:{getItem:(key:string)=>stored.get(key),setItem:(key:string,value:string)=>stored.set(key,value)},Date,crypto,
    require:(name:string)=>{
      if(name==='react')return {...react,useState(initial:any){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value}]}};
      if(name==='../lib/researchStudio')return studio;
      if(name==='../lib/language')return {useI18n:()=>({t:(key:string)=>key,language:'zh-CN'})};
      if(name==='../components/SideDrawer')return {SideDrawer:(props:any)=>props.open?props.children:null};
      if(name==='../components/ConfirmDialog')return {ConfirmDialog:()=>null};
      if(name==='../lib/presentation')return {copyText:async()=>true};
      if(name.endsWith('.css'))return{};return require(name);
    },
  });
  const flatten=(node:any):any[]=>{if(node==null||typeof node==='boolean')return[];if(Array.isArray(node))return node.flatMap(flatten);if(typeof node==='string'||typeof node==='number')return[node];if(typeof node.type==='function')return flatten(node.type(node.props));return[node,...flatten(node.props?.children)]};
  const text=(node:any)=>flatten(node).filter(n=>typeof n==='string').join(' ');
  const render=()=>{cursor=0;return flatten(exports.default())};
  const button=(nodes:any[],label:string)=>nodes.find(n=>n.type==='button'&&text(n).includes(label));
  let nodes=render();
  nodes.find(n=>n.type==='select'&&n.props['aria-label']==='researchStudio.perspective').props.onChange({target:{value:'lin'}});
  nodes=render();button(nodes,'researchStudio.viewLine').props.onClick();nodes=render();
  button(nodes,'复现 TIGER 基线并固定环境').props.onClick();nodes=render();
  button(nodes,'researchStudio.submitReview').props.onClick();
  assert.equal(stored.size,0,'incomplete evidence must not be submitted');
  nodes=render();for(const checkbox of nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox'&&!n.props.checked))checkbox.props.onChange({target:{checked:true}});
  nodes=render();for(const checkbox of nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox'&&!n.props.checked))checkbox.props.onChange({target:{checked:true}});
  nodes=render();button(nodes,'researchStudio.submitReview').props.onClick();
  assert.equal(JSON.parse([...stored.values()][0]).tasks.find((t:any)=>t.id==='R03').state,'review');
  nodes=render();assert.equal(button(nodes,'researchStudio.accept'),undefined);
  nodes.find(n=>n.type==='select'&&n.props['aria-label']==='researchStudio.perspective').props.onChange({target:{value:'mentor'}});
  nodes=render();button(nodes,'researchStudio.accept').props.onClick();
  assert.equal(JSON.parse([...stored.values()][0]).tasks.find((t:any)=>t.id==='R03').state,'done');
});
