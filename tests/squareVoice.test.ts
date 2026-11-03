import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const realRequire=createRequire(import.meta.url);
function load(name:string,mocks:Record<string,unknown>={}){
  const exports:any={};
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/components/${name}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,DOMException,document:{hidden:false,addEventListener(){},removeEventListener(){}},require:(id:string)=>mocks[id]??(id.endsWith('.css')?{}:id==='../lib/language'?{useI18n:()=>({t:(key:string)=>key})}:realRequire(id)),
  });
  return exports;
}
const player=load('SquareVoicePreview',{'../lib/mediaPlaybackFocus':{claimMediaPlayback(){},releaseMediaPlayback(){}}});
const recorder=load('SquareVoiceRecorder',{'./SquareVoicePreview':player,'./BottomSheet':{BottomSheet:({children}:any)=>createElement('section',null,children)}});
const base={open:true,recording:false,starting:false,duration:12,maximum:60,preview:null,error:'',onRecord(){},onClose(){},onClear(){},onDone(){}};
const render=(props={})=>renderToStaticMarkup(createElement(recorder.SquareVoiceRecorder,{...base,...props}));
test('review replaces the recording controls with exactly one shared player',()=>{
  const html=render({preview:'blob:recording'});
  assert.equal((html.match(/<audio/g)??[]).length,1);
  assert.equal((html.match(/<button/g)??[]).length,3);
  assert.doesNotMatch(html,/controls=|square-capture-session|>mic<|square-voice-bars/);
  assert.match(html,/square.useRecording/);
});
test('recording and permission loading do not expose the previous recording',()=>{
  const recording=render({recording:true,preview:'blob:old'});
  assert.match(recording,/>stop</);
  assert.doesNotMatch(recording,/<audio|square.useRecording/);
  assert.match(render({starting:true,preview:'blob:old'}),/disabled=""/);
});
test('composer attaches one playable card instead of a thumbnail plus native bar',()=>{
  const editor=load('SquareComposerEditor',{'./SquareVoicePreview':player});
  const html=renderToStaticMarkup(createElement(editor.SquareComposerEditor,{text:'',photos:[],video:null,voice:{uri:'blob:voice',duration:10},external:null,limit:140,publishing:false,publishable:true,progress:0,onRemoveVoice(){}}));
  assert.equal((html.match(/<audio/g)??[]).length,1);
  assert.doesNotMatch(html,/controls=|is-audio|square-editor-audio/);
  assert.match(html,/square-voice-clip-remove/);
});
function harness(play:()=>Promise<void>){
  const cleanups:Array<()=>void>=[],states:unknown[]=[];
  let pauses=0,claims=0,releases=0;
  const audio={paused:true,currentTime:0,pause(){pauses++},play,load(){}};
  const module=load('SquareVoicePreview',{
    react:{useRef:(initial:unknown)=>({current:initial===null?audio:initial}),useState:(initial:unknown)=>{const index=states.length;states.push(initial);return [initial,(value:unknown)=>{states[index]=value}]},useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup)}},
    '../lib/mediaPlaybackFocus':{claimMediaPlayback(){claims++},releaseMediaPlayback(){releases++}},
  });
  const tree=module.SquareVoicePreview({uri:'blob:voice',duration:12});
  return {tree,audio,states,cleanups,counts:()=>({pauses,claims,releases})};
}
test('play rejection leaves a retryable player and seeking updates the audio element',async()=>{
  const h=harness(()=>Promise.reject(new Error('Unavailable')));
  h.tree.props.children[0].props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.states[1],false);
  assert.equal(h.states[2],true);
  assert.equal(h.counts().claims,1);
  h.tree.props.children[1].props.children[1].props.onChange({target:{value:'4.5'}});
  assert.equal(h.audio.currentTime,4.5);
});
test('closing a preview stops audio and ignores a late play rejection',async()=>{
  let reject!:(error:Error)=>void;
  const h=harness(()=>new Promise((_,failure)=>{reject=failure}));
  h.tree.props.children[0].props.onClick();
  h.cleanups.forEach(cleanup=>cleanup());
  reject(new Error('Late failure'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.counts().pauses,1);
  assert.equal(h.counts().releases,1);
  assert.equal(h.states[2],false);
});
