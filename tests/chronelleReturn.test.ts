import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rememberChronelleReturn,readChronelleReturn,clearChronelleReturn,chronelleReturnDestination,isChronelleReturn} from '../src/lib/chronelleReturn.ts';

function storage(): Storage {
  const values=new Map<string,string>();
  return {get length(){return values.size;},key:(index)=>[...values.keys()][index]??null,getItem:(key)=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:(key)=>{values.delete(key);},clear:()=>values.clear()};
}
const state='test_state_012345678901234567890123456789';
const now=1000000;
const callback=(origin='https://frienden.6-79.cn')=>new URL(origin+'/app/research?code=test-only-code&state='+state);

test('all four origins restore the initiating space without changing the registered root callback',()=>{
  for(const origin of ['https://sermo.jyonn.space','https://frienden.jyonn.space','https://sermo.6-79.cn','https://frienden.6-79.cn']){
    const store=storage();rememberChronelleReturn(state,'my-lab',42,store,now);
    const target=chronelleReturnDestination(callback(origin),store,now)!;
    assert.equal(target.origin,origin);assert.equal(target.pathname,'/my-lab/app/research');
    assert.equal(target.searchParams.get('code'),'test-only-code');
    assert.ok(isChronelleReturn(target));
    assert.equal(readChronelleReturn(state,store,now)?.userId,42);
    assert.doesNotMatch(store.getItem(store.key(0)!)!,/code|token|secret/);
  }
});
test('unknown, expired and malformed contexts never guess a space',()=>{
  const store=storage();assert.equal(chronelleReturnDestination(callback(),store,now),null);
  rememberChronelleReturn(state,'lab',42,store,now);
  assert.equal(chronelleReturnDestination(callback(),store,now+600000),null);
  store.setItem(store.key(0)!,JSON.stringify({slug:'//evil.example',userId:42,until:now+600000}));
  assert.equal(chronelleReturnDestination(callback(),store,now),null);
  assert.throws(()=>rememberChronelleReturn(state,'../space',42,store,now));
});
test('denial callbacks restore space; root accounts and already scoped paths stay unchanged',()=>{
  const store=storage();rememberChronelleReturn(state,'lab',42,store,now);
  const denied=callback();denied.searchParams.delete('code');denied.searchParams.set('error','access_denied');
  assert.equal(chronelleReturnDestination(denied,store,now)?.pathname,'/lab/app/research');
  const scoped=callback();scoped.pathname='/lab/app/research';
  assert.equal(chronelleReturnDestination(scoped,store,now),null);
  rememberChronelleReturn(state,null,42,store,now);
  assert.equal(chronelleReturnDestination(callback(),store,now),null);
  clearChronelleReturn(state,store);assert.equal(readChronelleReturn(state,store,now),null);
});
test('routing is restored before basename and callbacks are intercepted before RequireAuth',()=>{
  const read=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
  const main=read('main.tsx');
  assert.ok(main.indexOf('const destination = chronelleReturnDestination')<main.indexOf('const routerBasename'));
  assert.match(read('App.tsx'),/rootChronelleReturn && !session/);
  assert.match(read('components/ChronellePluginDialog.tsx'),/rememberChronelleReturn\(target.searchParams.get\('state'\)/);
});
