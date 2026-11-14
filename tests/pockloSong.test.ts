import assert from 'node:assert/strict';
import test from 'node:test';
import {SongSession,SongError,isPockloSong,playbackFresh,cueLines,type SongMetadata,type SongPlayback,type SongReference} from '../src/lib/pockloSong.ts';
import {readPockloPickerMessage} from '../src/lib/pockloPicker.ts';
const id='11111111-1111-4111-8111-111111111111';
const ref:SongReference={provider:'pocklo_music',schema:'pocklo.song.v1',song_id:id,title:'Silent',artists:[],canonical_url:'https://pocklo.jyonn.space/share/'+id,audio_url:''};
const meta:SongMetadata={schema:'pocklo.song.v1',type:'song',song_id:id,version:1,available:true,title:'Silent',artists:[],album:'',duration_ms:20000,cover:null,share_url:ref.canonical_url,lyrics:{type:'synchronized',text:'hello',cues:[{time_ms:1234,text:'hello'}]}};
function media(version=1):SongPlayback{return {schema:'pocklo.song.v1',song_id:id,version,expires_at:new Date(Date.now()+300000).toISOString(),audio:{url:'https://res.6-79.cn/test?revision='+version,mime:'audio/mpeg'},cover:null}}
class Audio extends EventTarget{src='';paused=true;currentTime=0;duration=20;volume=.4;muted=true;crossOrigin='';preload='';loads=0;playCount=0;pause(){this.paused=true}removeAttribute(name:string){if(name==='src')this.src=''}load(){this.loads++;if(this.src)setTimeout(()=>this.dispatchEvent(new Event('loadedmetadata')),0)}async play(){this.paused=false;this.playCount++}}
const tick=()=>new Promise(r=>setTimeout(r,25));
function session(fetcher:(path:string,signal:AbortSignal)=>Promise<unknown>){const audio=new Audio(),states:number[]=[],updates:SongMetadata[]=[];const session=new SongSession(audio as unknown as HTMLAudioElement,fetcher as never,s=>updates.push(s),(_,e)=>states.push(e));return {audio,session,states,updates}}
test('replaying a completed song starts from zero',async()=>{const h=session(async path=>path.endsWith('/song')?meta:media());h.session.start(ref);await tick();h.audio.currentTime=20;h.audio.paused=true;Object.defineProperty(h.audio,'ended',{value:true});h.session.resume();await tick();assert.equal(h.audio.currentTime,0);assert.equal(h.audio.paused,false);h.session.stop()});
test('stable reference validation, millisecond cues and expiry safety margin',()=>{
 assert.ok(isPockloSong(ref));assert.ok(!isPockloSong({...ref,canonical_url:ref.canonical_url+'?signed=1'}));assert.deepEqual(cueLines(meta.lyrics.cues),[{time:1.234,text:'hello'}]);assert.ok(playbackFresh(media()));assert.ok(!playbackFresh({...media(),expires_at:new Date(Date.now()+14000).toISOString()}));
});
test('actual deployed iframe resource types retain song summary and strict source checks',()=>{
 const frame={} as Window;const event={source:frame,origin:'https://pocklo.jyonn.space',data:{type:'song',version:1,url:ref.canonical_url,song:{song_id:id,version:2,title:'Silent'}}} as MessageEvent;
 assert.equal(readPockloPickerMessage(event,frame)?.type,'selected');assert.equal(readPockloPickerMessage({...event,origin:'https://evil.example'} as MessageEvent,frame),null);
});
test('plays and seeks directly, preserves volume and pause when signed URL changes',async()=>{
 let m=media();const h=session(async path=>path.endsWith('/song')?meta:m);h.session.start(ref);await tick();assert.equal(h.audio.paused,false);assert.equal(h.audio.crossOrigin,'anonymous');h.session.pause();h.audio.currentTime=8;m={...media(),expires_at:new Date(Date.now()+1000).toISOString(),audio:{...m.audio,url:m.audio.url+'new'}};
 // Force one media refresh, then seek while paused.
 h.session.mediaError();await tick();h.session.seek(11);await tick();assert.equal(h.audio.currentTime,11);assert.equal(h.audio.paused,true);assert.equal(h.audio.volume,.4);assert.equal(h.audio.muted,true);h.session.stop();
});
test('media failure refreshes at most once until explicit retry',async()=>{
 let count=0;const h=session(async path=>{if(path.endsWith('/song'))return meta;count++;return {...media(),audio:{...media().audio,url:'https://res.6-79.cn/test?'+count}}});h.session.start(ref);await tick();h.session.mediaError();await tick();h.session.mediaError();await tick();assert.equal(count,2);assert.equal(h.states.at(-1),503);h.session.resume();await tick();assert.equal(h.audio.paused,false);h.session.stop();
});
test('404 and 410 stop playback and never retry automatically',async()=>{for(const code of [404,410]){let requests=0;const h=session(async()=>{requests++;throw new SongError(code)});h.session.start(ref);await tick();h.session.resume();h.session.mediaError();await tick();assert.equal(requests,1);assert.equal(h.session.terminal,code);assert.equal(h.audio.src,'');h.session.stop()}});
test('audio unavailable metadata never requests a signed address',async()=>{let count=0;const h=session(async()=>{count++;return {...meta,available:false}});h.session.start(ref);await tick();assert.equal(count,1);assert.equal(h.session.terminal,410);h.session.stop()});
test('version changes refresh metadata before applying playback',async()=>{let reads=0;const h=session(async path=>path.endsWith('/song')?{...meta,version:++reads>1?2:1}:media(2));h.session.start(ref);await tick();assert.equal(reads,2);assert.equal(h.updates[0].version,2);h.session.stop()});
test('rapid switching ignores even non-abortable old responses',async()=>{let resolve:(v:unknown)=>void=()=>{};let first=true;const h=session(async path=>{if(first){first=false;return new Promise(r=>resolve=r)}return path.endsWith('/song')?meta:media()});h.session.start(ref);h.session.start(ref);await tick();resolve({...meta,title:'stale'});await tick();assert.ok(h.updates.every(s=>s.title!=='stale'));assert.equal(h.audio.playCount,1);h.session.stop()});
