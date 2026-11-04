import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import postcss from 'postcss';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('system footprint arrow dispatches the shared permission-aware entry event',()=>{
  const module={exports:{} as any};let dispatched:any;let stopped=false;
  const require=createRequire(import.meta.url);
  runInNewContext(ts.transpileModule(read('../src/components/SystemMessageText.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module,exports:module.exports,window:{dispatchEvent:(event:unknown)=>{dispatched=event}},CustomEvent:class{type:string;detail:unknown;constructor(type:string,options:{detail:unknown}){this.type=type;this.detail=options.detail}},
    require:(id:string)=>id.endsWith('.css')?{}:id==='../lib/language'?{useI18n:()=>({t:(key:string)=>key})}:id==='../lib/systemMessage'?{systemMessageParts:()=>['Shared footprints']}:require(id),
  });
  const element=module.exports.SystemMessageText({message:{id:12,from:'other',payload:{event:'travel_map_shared'}},context:{viewerId:2}});
  const button=element.props.children[1];
  assert.equal(button.type,'button');assert.equal(button.props['aria-label'],'message.system.openFootprints');
  button.props.onClick({stopPropagation(){stopped=true}});
  assert.ok(stopped);assert.equal(dispatched.type,'sermo:travel-map-message');
  assert.equal(dispatched.detail.messageId,12);assert.equal(dispatched.detail.chatGrant,true);
});
test('avatar faces stay horizontal and the system arrow remains clickable inside a disabled row',()=>{
  const stack=postcss.parse(read('../src/components/MemberAvatarStack.css'));
  let display='';stack.walkRules('.member-avatar-stack>.member-avatar-stack-faces',rule=>{rule.walkDecls('display',decl=>{display=decl.value})});
  assert.equal(display,'flex');
  const profile=postcss.parse(read('../src/styles/app/20-profile-settings.css'));
  profile.walkRules(rule=>{assert.notEqual(rule.selector,'.travel-map-owner > span')});
  const system=postcss.parse(read('../src/components/SystemMessageText.css'));
  let pointer='';system.walkRules('.system-message-copy .message-system-view',rule=>{rule.walkDecls('pointer-events',decl=>{pointer=decl.value})});
  assert.equal(pointer,'auto');
  system.walkRules('.message-system-self',rule=>rule.walkDecls(decl=>{assert.notEqual(decl.prop,'background')}));
});
