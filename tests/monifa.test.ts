import test from 'node:test';
import assert from 'node:assert/strict';
import {monifaShareUrl} from '../src/lib/monifa.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const url='https://monifa.jyonn.space/#/share/'+'A'.repeat(43);
test('only exact Monifa share links become OTP cards',()=>{
  assert.equal(monifaShareUrl(url),url);
  for(const invalid of ['https://monifa.jyonn.space/',url.replace('/#/share/','/share/'),url+'/more',url.replace('.space/','.space.evil/'),url.replace('https:','http:'),url+'?q=1',url.replace('monifa.','user@monifa.')])assert.equal(monifaShareUrl(invalid),null);
});

test('production card refreshes, hides expired codes and aborts on close',async()=>{
  const require=createRequire(import.meta.url),React=require('react'),slots:any[]=[];
  let index=0,effect:any,tick:any,now=1000,requestCount=0,lastSignal:AbortSignal|undefined;
  const exports:any={};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/MonifaOtpCard.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,AbortController,Date:{now:()=>now},setTimeout:()=>1,clearTimeout(){},setInterval:(fn:any)=>{tick=fn;return 1},clearInterval(){},
    require:(name:string)=>{
      if(name==='react')return {...React,useState(initial:any){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial:any){const i=index++;return slots[i]??(slots[i]={current:initial})},useEffect(fn:any){effect=fn}};
      if(name==='../lib/api')return{api:{getMonifaOtp:async(_:string,signal:AbortSignal)=>{requestCount++;lastSignal=signal;return {status:'ready',code:requestCount===1?'123456':'654321',period:30,remaining:30,issuer:'Fixture'}}}};
      if(name==='../lib/language')return{useI18n:()=>({t:(key:string)=>key})};
      if(name==='../lib/presentation')return{copyText:async()=>true};
      if(name.endsWith('.css'))return{};return require(name);
    },
  });
  const render=()=>{index=0;return exports.MonifaOtpCard({url})};
  render();const cleanup=effect();await new Promise(r=>setImmediate(r));
  let tree=render();assert.equal(tree.props.children[2].props.disabled,false);assert.equal(tree.props.children[2].props.children[0].props.children,'123 456');
  now+=31000;tick();tree=render();assert.equal(tree.props.children[2].props.disabled,true);assert.equal(tree.props.children[2].props.children[0].props.children,'••• •••');
  await tree.props.children[4].props.children[1].props.onClick();await new Promise(r=>setImmediate(r));
  tree=render();assert.equal(requestCount,2);assert.equal(tree.props.children[2].props.children[0].props.children,'654 321');
  cleanup();assert.ok(lastSignal?.aborted);
});
