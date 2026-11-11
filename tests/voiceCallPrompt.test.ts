import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import ts from 'typescript';

const realRequire=createRequire(import.meta.url);
function load(path:string,extra:Record<string,unknown>={}) {
  const exports:Record<string,any>={};
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,document:{body:{}},require(id:string){
    if(id in extra)return extra[id];
    if(id==='react')return {...React,useEffect(){},useId:()=> 'voice-sheet',useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>[value,()=>{}]};
    if(id==='react-dom')return {createPortal:(node:unknown)=>node};
    if(id==='../lib/language')return {useI18n:()=>({t:(key:string)=>key})};
    if(id==='../lib/bodyLock')return {useBodyScrollLock(){}};
    if(id==='../lib/modalFocus')return {useModalFocus(){}};
    if(id.endsWith('.css'))return {};
    if(id==='./InlineAlert')return {InlineAlert:()=>null};
    return realRequire(id);
  }});
  return exports;
}
const {ActionSheet}=load('../src/components/ActionSheet.tsx');
const {VoiceCallPrompt}=load('../src/components/VoiceCallPrompt.tsx',{
  './ActionSheet':{ActionSheet},'./ConfirmDialog':{ConfirmDialog:()=>null},
  './ChatActionIcon':{ChatActionIcon:()=>null},'../lib/voiceCalls':{voiceErrorKey:(reason:string)=>`voice.error.${reason}`},
});
function elements(node:any):any[]{return node?.props?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}

test('the ready call menu contains one voice action and a separate cancel button',()=>{
  const prompt=VoiceCallPrompt({open:true,cap:{can_call:true},onClose(){},onConfirm(){}});
  assert.equal(prompt.type,ActionSheet);
  const nodes=elements(ActionSheet(prompt.props));
  const buttons=nodes.filter(node=>node.type==='button');
  assert.equal(buttons.length,2);
  assert.equal(nodes.find(node=>node.type==='header').props.hidden,true);
  assert.equal(prompt.props.actions[0].label,'voice.title');
  assert.equal(buttons[1].props.children,'common.cancel');
});
test('a pending call cannot be submitted twice or auto-dismiss the owner-managed flow',async()=>{
  let selected=0,closed=0,resolve!:()=>void;
  const pending=new Promise<void>(done=>resolve=done);
  const prompt=VoiceCallPrompt({open:true,cap:{can_call:true},onClose(){closed++},onConfirm(){selected++;return pending}});
  const buttons=elements(ActionSheet(prompt.props)).filter(node=>node.type==='button');
  buttons[0].props.onClick();buttons[0].props.onClick();
  assert.equal(selected,1);assert.equal(closed,0);
  resolve();await pending;await Promise.resolve();await Promise.resolve();
  assert.equal(closed,0);
  buttons[1].props.onClick();assert.equal(closed,1);
});
test('other action sheets still dismiss after a successful action by default',async()=>{
  let closed=0;
  const nodes=elements(ActionSheet({open:true,title:'test',onClose(){closed++},actions:[{key:'test',label:'test',onSelect(){}}]}));
  nodes.find(node=>node.type==='button').props.onClick();
  await Promise.resolve();await Promise.resolve();
  assert.equal(closed,1);
});
test('blocked calls retain a persistent error dialog instead of a dial option',()=>{
  const prompt=VoiceCallPrompt({open:true,cap:{can_call:false,reason:'peer_quota_empty'},onClose(){}});
  assert.notEqual(prompt.type,ActionSheet);
  assert.equal(prompt.props.description,'voice.error.peer_quota_empty');
  assert.equal(prompt.props.showCancelButton,false);
});
