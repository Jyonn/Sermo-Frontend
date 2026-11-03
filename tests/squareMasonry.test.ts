import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeSquareColumns,squareCover,textCoverStyle,squareMediaRatio} from '../src/lib/squareFeedLayout.ts';
import {getSquareFeedLayout,setSquareFeedLayout} from '../src/lib/useSquareFeedLayout.ts';
import type {SquareStatementDTO} from '../src/types';
const item=(id:number)=>({statement_id:id,text:'文字封面 '+id,media:[]}) as unknown as SquareStatementDTO;
test('responsive masonry never drops or duplicates items and appending preserves existing columns',()=>{
 const items=Array.from({length:50},(_,index)=>item(index+1));
 for(const [width,count] of [[390,2],[900,3],[1400,4]]){
  const first=arrangeSquareColumns(items.slice(0,20),width),all=arrangeSquareColumns(items,width);
  assert.equal(all.length,count);assert.deepEqual(all.flat().map(row=>row.statement_id).sort((a,b)=>a-b),items.map(row=>row.statement_id));
  first.forEach((column,index)=>assert.deepEqual(all[index].slice(0,column.length),column));
 }
});
test('covers reserve image geometry and long text remains deterministic',()=>{
 const row={...item(3),media:[{kind:'image',uri:'full',thumbnail_uri:'thumb',metadata:{pixel_width:100,pixel_height:900}}]} as SquareStatementDTO;
 assert.equal(squareCover(row).uri,'thumb');assert.equal(squareCover(row).fallbackUri,'full');assert.equal(squareCover(row).ratio,2/3);
 assert.equal(squareMediaRatio(9000,100),3/2);assert.equal(squareMediaRatio(0,100),.8);
 assert.deepEqual(textCoverStyle(3,'长'.repeat(200)),textCoverStyle(3,'长'.repeat(200)));
 assert.equal(textCoverStyle(3,'长'.repeat(200)).font,'small');
});
test('layout preferences are scoped to each account and survive unavailable storage',()=>{
 assert.equal(getSquareFeedLayout('fixture:1'),'masonry');setSquareFeedLayout('fixture:1','list');
 assert.equal(getSquareFeedLayout('fixture:1'),'list');assert.equal(getSquareFeedLayout('fixture:2'),'masonry');
 setSquareFeedLayout('fixture:1','list');assert.equal(getSquareFeedLayout('fixture:1'),'list');
});
test('mixed posts use the first image, video poster, audio card, album art and Stillfolio cover',()=>{
 const images=Array.from({length:9},(_,index)=>({media_id:index,kind:'image',uri:`image-${index}`,thumbnail_uri:`thumb-${index}`}));
 const multi=squareCover({...item(1),media:images} as SquareStatementDTO);
 assert.equal(multi.uri,'thumb-0');assert.equal(multi.count,9);assert.equal(multi.kind,'image');
 const video=squareCover({...item(2),media:[{media_id:1,kind:'video',uri:'movie.mp4',thumbnail_uri:'poster',duration_seconds:93}]} as SquareStatementDTO);
 assert.equal(video.uri,'poster');assert.equal(video.video,true);assert.equal(video.duration,93);
 const audio=squareCover({...item(3),media:[{media_id:1,kind:'audio',uri:'voice.mp3',duration_seconds:31}]} as SquareStatementDTO);
 assert.equal(audio.uri,null);assert.equal(audio.kind,'audio');assert.equal(audio.duration,31);
 const external=(provider_data:Record<string,unknown>)=>({...item(4),external_media:{status:'ready',provider_data}}) as SquareStatementDTO;
 for(const provider of ['netease_music','qq_music','kugou_music','qishui_music','apple_music','kuwo_music']){
  const cover=squareCover(external({provider,cover_url:'album',title:'歌曲',duration_ms:180000}));
  assert.equal(cover.uri,'album');assert.equal(cover.kind,'music');assert.equal(cover.ratio,1);assert.equal(cover.duration,180);
 }
 const collection=squareCover(external({provider:'stillfolio_collection',title:'作品集',cover_url:'cover',images:['first','second'],photo_count:18}));
 assert.equal(collection.uri,'cover');assert.equal(collection.fallbackUri,'first');assert.equal(collection.count,18);assert.equal(collection.kind,'collection');
 const noCover=squareCover(external({provider:'stillfolio_collection',images:['first'],photo_count:1}));
 assert.equal(noCover.uri,'first');
});
test('device storage restores a known preference and rejects unknown values',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map([['frienden:square-layout:v1:stored:1','masonry'],['frienden:square-layout:v1:stored:2','unknown'],['frienden:square-layout:v1:stored:3','list']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 try{
  assert.equal(getSquareFeedLayout('stored:1'),'masonry');assert.equal(getSquareFeedLayout('stored:2'),'masonry');assert.equal(getSquareFeedLayout('stored:3'),'list');
  setSquareFeedLayout('stored:2','masonry');assert.equal(values.get('frienden:square-layout:v1:stored:2'),'masonry');
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage')}
});
