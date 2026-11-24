import {api} from './api';
import type {MusicProviderDataDTO} from '../types';

export type MusicSource = {surface:'chat'|'square';source_id:number};
const eligibleProviders = new Set<string>(['netease_music','qq_music','pocklo_music']);
const recordShopEditions = ['record-shop', 'record-shop-women'] as const;

class PlaybackReceipt {
  private readonly ready;
  private ranges:number[][] = [];
  private reported = false;
  private stopped = false;

  constructor(source:MusicSource, music:MusicProviderDataDTO) {
    this.ready = recordShopEditions.map(async key => ({
      key,
      credentials: await api.recordShopStart(key,{...source,provider:music.provider,song_id:music.song_id}).catch(()=>null),
    }));
  }

  collect(element:HTMLAudioElement) {
    if(this.stopped || this.reported) return;
    const ranges = element.played;
    const combined = [...this.ranges];
    for(let index=0;index<ranges.length;index+=1) {
      const start=Math.round(ranges.start(index)*1000);
      const end=Math.round(ranges.end(index)*1000);
      if(end>start) combined.push([start,end]);
    }
    combined.sort(([left],[right])=>left-right);
    this.ranges=[];
    for(const range of combined) {
      const previous=this.ranges[this.ranges.length-1];
      if(previous && range[0]<=previous[1]) previous[1]=Math.max(previous[1],range[1]);
      else this.ranges.push([...range]);
    }
  }

  async complete(element:HTMLAudioElement) {
    if(!element.ended || this.stopped || this.reported || !Number.isFinite(element.duration)) return;
    this.collect(element);
    const duration_ms=Math.round(element.duration*1000);
    const played=this.ranges;
    if(played.length===0 || played.length>64) return;
    this.reported=true;
    const outcomes = await Promise.all(this.ready.map(async request => {
      const {key, credentials} = await request;
      if (!credentials?.receipt) return null;
      return api.recordShopFinish(key,{receipt:credentials.receipt,duration_ms,played,ended:true}).catch(()=>null);
    }));
    if(outcomes.some(outcome => outcome?.points)) window.dispatchEvent(new CustomEvent('frienden:activity-updated'));
  }

  stop() { this.stopped=true; }
}

export function startRecordShopPlayback(source:MusicSource|undefined,music:MusicProviderDataDTO) {
  return source && eligibleProviders.has(music.provider) ? new PlaybackReceipt(source,music) : null;
}
