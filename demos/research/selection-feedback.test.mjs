import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const directory=execFileSync('python3',[new URL('./prepare-chronelle-assets.py',import.meta.url).pathname],{encoding:'utf8'}).trim();
const {selectionFeedback,mountEmbed}=await import(pathToFileURL(directory+'/embed_assets/bridge.mjs'));
const value={start:'2026-10-29T09:00:00+08:00',end:'2026-10-29T10:00:00+08:00'};
test('overlapping events warn without disclosing titles or counts',()=>{
  const event={start:'2026-10-29T09:30:00+08:00',end:'2026-10-29T11:00:00+08:00',title:'Do not copy'};
  assert.deepEqual(selectionFeedback([event],'complete',value),{tone:'conflict',label:'与已有日程重叠'});
  assert.equal(selectionFeedback([event],'partial',value).tone,'conflict');
});
test('adjacent intervals are not a conflict; partial visibility never implies free',()=>{
  assert.equal(selectionFeedback([{start:value.end,end:'2026-10-29T11:00:00+08:00'}],'complete',value).tone,'neutral');
  assert.deepEqual(selectionFeedback([],'partial',value),{tone:'unknown',label:'忙闲未知'});
  assert.deepEqual(selectionFeedback([],'complete',value),{tone:'neutral',label:'待预约时间'});
});
test('all-day occupancy overlaps timed selection',()=>{
  assert.equal(selectionFeedback([{start:'2026-10-29T00:00:00+08:00',end:'2026-10-30T00:00:00+08:00',all_day:true}],'complete',value).tone,'conflict');
});
test('mounted selection leaves cards unobscured and labels time outside the grid',async()=>{
  class Element {
    constructor(){this.handlers={};this.style={};this.dataset={};this.children=[];this.hidden=false;this.textContent='';}
    addEventListener(type,fn){this.handlers[type]=fn;}fire(type,event={}){this.handlers[type]?.({target:this,preventDefault(){},...event});}
    replaceChildren(){this.children=[];}append(...items){this.children.push(...items);}setAttribute(){}setPointerCapture(){}getBoundingClientRect(){return {top:0};}closest(){return null;}
  }
  const names=['embed-config','day','status','summary','calendar','grid','range','selection','reload','select-mode','events','all-day','hours'];
  const elements=Object.fromEntries(names.map(name=>[name,new Element()]));
  const id='11111111-1111-1111-1111-111111111111';elements['embed-config'].textContent=JSON.stringify({display_id:id,allowed_origins:['https://app.example']});
  const document={hidden:false,body:new Element(),getElementById:id=>elements[id],createElement:()=>new Element(),addEventListener(){}};
  const sent=[],listeners={},parent={postMessage:message=>sent.push(message)};
  const window={parent,addEventListener:(type,fn)=>listeners[type]=fn,fetch:async()=>({ok:true,json:async()=>({events:[{...value,visibility:'details',title:'Existing event'}],coverage:'complete',availability:'known',expires_at:'2099-01-01T00:00:00Z'})})};
  mountEmbed(document,window);
  try {
    listeners.message({source:parent,origin:'https://app.example',data:{protocol:'chronelle.calendar',version:1,type:'connect',channel:'test-selection-123456',request_id:'1',payload:{display_ids:[id],date:'2026-10-29'}}});
    await new Promise(resolve=>setImmediate(resolve));
    const local=new Date(value.start),slot=(local.getHours()*60+local.getMinutes())/30;
    elements.grid.fire('pointerdown',{button:0,pointerId:1,clientY:slot*30,pointerType:'mouse'});
    assert.equal(elements.range.textContent,'');assert.equal(elements.range.dataset.tone,'conflict');
    assert.match(elements.selection.textContent,/与已有日程重叠/);assert.equal(elements.selection.hidden,false);
    elements.grid.fire('pointerup',{pointerId:1});assert.equal(sent.at(-1).type,'range-selected');
    elements.grid.fire('keydown',{key:'Escape'});assert.equal(elements.selection.hidden,true);
  } finally {listeners.pagehide();}
  const css=readFileSync(directory+'/embed_assets/shell.css','utf8');
  assert.match(css,/#events\{z-index:2\}#range\{z-index:1/);
});
