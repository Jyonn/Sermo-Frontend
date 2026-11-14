import {pockloShareToken} from './pockloShare.ts';

export interface SongReference {provider:'pocklo_music';schema:'pocklo.song.v1';song_id:string;canonical_url:string;title:string;artists:string[];version?:number;album?:string;duration_ms?:number|null;available?:boolean;audio_url:string}
export interface SongMetadata {schema:'pocklo.song.v1';type:'song';song_id:string;version:number;available:boolean;title:string;artists:string[];album:string;duration_ms:number|null;cover:{id:string;mime:string}|null;share_url:string;lyrics:{type:'none'|'text'|'lrc'|'synchronized';text:string;cues:{time_ms:number;text:string}[]}}
export interface SongPlayback {schema:string;song_id:string;version:number;expires_at:string;audio:{url:string;mime:string};cover:{url:string;mime:string}|null}
export class SongError extends Error {status:number;constructor(status:number){super(status===404?'share_not_found':status===410?'audio_unavailable':'unavailable');this.status=status}}
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function isPockloSong(value:unknown):value is SongReference {const v=value as SongReference|null;return !!v&&v.provider==='pocklo_music'&&v.schema==='pocklo.song.v1'&&uuid.test(v.song_id)&&!!pockloShareToken(v.canonical_url)&&typeof v.title==='string'&&Array.isArray(v.artists)}
export function songSummary(value:unknown){const v=value as {song_id?:unknown;version?:unknown;title?:unknown}|null;return v&&typeof v.song_id==='string'&&uuid.test(v.song_id)&&Number.isSafeInteger(v.version)&&typeof v.title==='string'?{song_id:v.song_id,version:Number(v.version),title:v.title}:undefined}
export function songLyrics(song:SongMetadata){return {original:song.lyrics.text,cues:song.lyrics.cues}}
export function validPlayback(data:SongPlayback,id:string){return data?.schema==='pocklo.song.v1'&&data.song_id===id&&Number.isFinite(Date.parse(data.expires_at))&&!!data.audio?.url&&data.audio.mime.startsWith('audio/')}
export function playbackFresh(data:SongPlayback,now=Date.now()){return Date.parse(data.expires_at)-now>15_000}
export function cueLines(cues?:{time_ms:number;text:string}[]){return cues?.filter(c=>Number.isFinite(c.time_ms)&&c.time_ms>=0&&typeof c.text==='string').map(c=>({time:c.time_ms/1000,text:c.text})).sort((a,b)=>a.time-b.time)??[]}

/** Coordinates one audio element; signatures live only on this short-lived instance. */
export class SongSession {
  private audio:HTMLAudioElement;
  private fetcher:<T>(url:string,signal:AbortSignal)=>Promise<T>;
  private update:(song:SongMetadata,playback:SongPlayback)=>void;
  private state:(loading:boolean,error:number)=>void;
  private controller?:AbortController;
  private generation=0;
  private playback?:SongPlayback;
  private reference?:SongReference;
  private retries=0;
  private busy=false;
  private intendedPlaying=false;
  terminal=0;
  constructor(audio:HTMLAudioElement,fetcher:<T>(url:string,signal:AbortSignal)=>Promise<T>,update:(song:SongMetadata,playback:SongPlayback)=>void,state:(loading:boolean,error:number)=>void){this.audio=audio;this.fetcher=fetcher;this.update=update;this.state=state}
  private endpoint(ref:SongReference){return '/users/pocklo/shares/'+pockloShareToken(ref.canonical_url)}
  stop(){this.generation++;this.controller?.abort();this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.reference=undefined;this.playback=undefined;this.terminal=0;this.busy=false}
  start(ref:SongReference){this.stop();this.reference=ref;this.retries=0;this.intendedPlaying=true;void this.load(0,true,true)}
  resume(){if(this.terminal||!this.reference)return;this.retries=0;void this.load(this.audio.ended?0:this.audio.currentTime,true,false)}
  pause(){this.intendedPlaying=false;this.audio.pause()}
  seek(time:number){if(this.terminal||!this.reference)return;this.retries=0;void this.load(time,this.busy?this.intendedPlaying:!this.audio.paused,false)}
  mediaError(){if(this.busy||this.terminal||!this.reference)return;if(this.retries++<1)void this.load(this.audio.currentTime,this.intendedPlaying,true);else this.state(false,503)}
  private async load(time:number,play:boolean,force:boolean){
    const ref=this.reference;if(!ref||this.terminal)return;
    this.intendedPlaying=play;
    this.controller?.abort();const controller=new AbortController();this.controller=controller;const signal=controller.signal;const generation=++this.generation;
    const volume=this.audio.volume,muted=this.audio.muted;
    this.busy=true;this.state(true,0);
    try{
      const base=this.endpoint(ref);
      const song=await this.fetcher<SongMetadata>(base+'/song',signal);
      if(signal.aborted||generation!==this.generation)return;
      if(song.song_id!==ref.song_id||song.schema!=='pocklo.song.v1')throw new SongError(503);
      if(!song.available)throw new SongError(410);
      let playback=this.playback;
      if(force||!playback||!playbackFresh(playback)||playback.version!==song.version)playback=await this.fetcher<SongPlayback>(base+'/playback',signal);
      if(signal.aborted||generation!==this.generation)return;
      if(!validPlayback(playback,ref.song_id))throw new SongError(503);
      let metadata=song;
      if(playback.version!==song.version){metadata=await this.fetcher<SongMetadata>(base+'/song',signal);if(metadata.version!==playback.version||metadata.song_id!==ref.song_id||!metadata.available)throw new SongError(503)}
      if(signal.aborted||generation!==this.generation)return;
      const changed=this.audio.src!==playback.audio.url;
      this.playback=playback;this.update(metadata,playback);
      if(changed){
        this.audio.pause();
        await new Promise<void>((resolve,reject)=>{
          const cleanup=()=>{clearTimeout(timer);this.audio.removeEventListener('loadedmetadata',ready);this.audio.removeEventListener('error',failed);signal.removeEventListener('abort',cancel)};
          const ready=()=>{cleanup();resolve()};const failed=()=>{cleanup();reject(new SongError(503))};const cancel=()=>{cleanup();reject(new DOMException('Aborted','AbortError'))};
          const timer=setTimeout(failed,15000);this.audio.addEventListener('loadedmetadata',ready);this.audio.addEventListener('error',failed);signal.addEventListener('abort',cancel,{once:true});
          this.audio.crossOrigin='anonymous';this.audio.preload='metadata';this.audio.src=playback!.audio.url;this.audio.load();
        });
      }
      if(signal.aborted||generation!==this.generation)return;
      this.audio.currentTime=Math.max(0,Math.min(time,Number.isFinite(this.audio.duration)?this.audio.duration:time));this.audio.volume=volume;this.audio.muted=muted;
      if(play)await this.audio.play();
      this.state(false,0);
    }catch(error){
      if(signal.aborted||generation!==this.generation)return;
      const status=error instanceof SongError?error.status:503;
      if(status===404||status===410){this.terminal=status;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.state(false,status)}
      else if((error as Error)?.name==='NotAllowedError'){this.state(false,503)}
      else if(this.retries++<1){this.busy=false;void this.load(time,play,true);return}
      else this.state(false,status);
    }finally{if(generation===this.generation)this.busy=false}
  }
}
