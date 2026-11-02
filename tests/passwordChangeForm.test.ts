import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {meetsPasswordPolicy} from '../src/lib/passwordPolicy.ts';

const require = createRequire(import.meta.url);
async function harness(hasPassword:boolean) {
  let cursor=0;
  const cells:any[]=[];
  const effects:Array<()=>void>=[];
  const calls:{verify:any[];update:any[];changed:any[]}={verify:[],update:[],changed:[]};
  const state=(initial:any)=>{const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],(next:any)=>{cells[i]=typeof next==='function'?next(cells[i]):next}]};
  const react={useState:state,useId:()=> 'password-test',useRef:(initial:any)=>state({current:initial})[0],useEffect:(effect:()=>void,deps:any[])=>{const i=cursor++;if(!cells[i]||deps.some((d,j)=>!Object.is(d,cells[i][j]))){cells[i]=deps;effects.push(effect)}}};
  const t=(key:string)=>key;
  const api={getPasswordChangeOptions:async()=>({has_password:hasPassword,channels:[],policy:{official:false,min_length:6,max_length:128,required_classes:0}}),verifyPasswordChange:async(payload:any)=>{calls.verify.push(payload);return{verified:true}},updatePassword:async(payload:any)=>{calls.update.push(payload);return{has_password:true}}};
  const exports:any={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/PasswordChangeForm.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,AbortController,Date,require:(name:string)=>name==='react'?react:name==='react-i18next'?{useTranslation:()=>({t})}:name==='../lib/api'?{api,ApiError:class extends Error{}}:name==='../lib/passwordPolicy'?{meetsPasswordPolicy}:name==='./VerificationCodeInput'?{VerificationCodeInput:()=>null}:name.endsWith('.css')?{}:require(name)});
  const render=()=>{cursor=0;const node=exports.PasswordChangeForm({onBusy:()=>{},onChanged:(result:any)=>calls.changed.push(result)});effects.splice(0).forEach(effect=>effect());return node};
  render();await Promise.resolve();let node=render();
  const all=(value:any):any[]=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(all):[value,...all(value.props?.children)];
  const input=(suffix:string)=>all(node).find(n=>n.type==='input'&&n.props.id.endsWith(suffix));
  const fill=(suffix:string,value:string)=>{input(suffix).props.onChange({target:{value}});node=render()};
  const submit=async()=>{node.props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));node=render()};
  return{calls,input,fill,submit};
}

test('passwordless accounts enter the new-password form and submit without verification',async()=>{
  const form=await harness(false);
  assert.equal(form.input('-old'),undefined);
  assert.ok(form.input('-new'));
  form.fill('-new','new-pass');form.fill('-confirm','new-pass');await form.submit();
  assert.equal(form.calls.verify.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(form.calls.update)),[{new_password:'new-pass',method:'password'}]);
  assert.equal(form.calls.changed.length,1);
});
test('existing passwords still require verification before the new-password form',async()=>{
  const form=await harness(true);
  assert.ok(form.input('-old'));assert.equal(form.input('-new'),undefined);
  form.fill('-old','old-pass');await form.submit();
  assert.equal(form.calls.verify.length,1);assert.equal(form.calls.update.length,0);
  form.fill('-new','new-pass');form.fill('-confirm','new-pass');await form.submit();
  assert.equal(form.calls.update[0].old_password,'old-pass');
});
test('first-time setup still rejects mismatched and weak passwords',async()=>{
  const form=await harness(false);
  form.fill('-new','new-pass');form.fill('-confirm','different');await form.submit();
  form.fill('-new','short');form.fill('-confirm','short');await form.submit();
  assert.equal(form.calls.update.length,0);assert.equal(form.calls.verify.length,0);
});
