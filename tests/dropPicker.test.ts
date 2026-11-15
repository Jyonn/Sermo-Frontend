import test from 'node:test';import assert from 'node:assert/strict';
import {DROP_API_ORIGIN,dropShareUrl,readDropPickerMessage} from '../src/lib/dropPicker.ts';
const frame={} as Window,url='https://drop.jyonn.space/?share='+'a'.repeat(43);
const event=(data:object,origin=DROP_API_ORIGIN,source:Window|null=frame)=>({data,origin,source}) as MessageEvent;
const request=(data:object)=>event({type:'drop.picker.request',version:1,requestId:'r-1',...data});
test('only the exact iframe origin and source can use the picker protocol',()=>{
  const ready={type:'drop.picker.ready',version:1};
  assert.equal(readDropPickerMessage(event(ready),frame)?.type,'ready');
  assert.equal(readDropPickerMessage(event(ready,'https://evil.test'),frame),null);
  assert.equal(readDropPickerMessage(event(ready,DROP_API_ORIGIN,{} as Window),frame),null);
  assert.equal(readDropPickerMessage(event({...ready,version:2}),frame),null);
});
test('diary requests respect query, paging, selection, fields, lifetime and operation bounds',()=>{
  assert.equal(readDropPickerMessage(request({action:'entries',query:'测试',offset:100000}),frame)?.type,'entries');
  for(const data of [{query:'x'.repeat(201),offset:0},{query:'',offset:-1},{query:'',offset:100001}])assert.equal(readDropPickerMessage(request({action:'entries',...data}),frame),null);
  const share={action:'share',entryIds:['e08e9580-3df8-4ae6-8d7b-9d1a7c25ad9a'],fields:['text','occurred_at'],expiresIn:86400,operationId:'operation-1'};
  assert.equal(readDropPickerMessage(request(share),frame)?.type,'share');
  for(const changes of [{fields:['text']},{fields:['text','occurred_at','event']},{expiresIn:59},{operationId:'bad/id'},{entryIds:[...share.entryIds,...share.entryIds]}])assert.equal(readDropPickerMessage(request({...share,...changes}),frame),null);
});
test('share URLs reject extra params, fragments, credentials and alternate hosts',()=>{
  assert.equal(dropShareUrl(url),url);
  assert.equal(readDropPickerMessage(event({type:'drop.picker.selected',version:1,url}),frame)?.type,'selected');
  for(const value of [url+'&x=1',url+'#x',url.replace('drop.jyonn.space','drop.jyonn.space.evil.test'),url.replace('https://','https://u:p@'),url+'&share='+'b'.repeat(43)])assert.equal(dropShareUrl(value),null);
});
