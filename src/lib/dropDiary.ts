/// <reference lib="es2022.intl" />
export interface DropDiaryPreview {
  status: 'ready' | 'gone' | 'error';
  text?: string;
  occurred_at?: string | null;
  count?: number;
  truncated?: boolean;
  expires_at?: string;
  remaining_seconds?: number;
  entries?: DropDiaryEntry[];
}

export interface DropDiaryEntry {
  text: string; occurred_at?: string; city?: string; place?: string;
  latitude?: number; longitude?: number;
  audio: {id:string;duration_seconds:number|null}[];
}

export function remainingShareSeconds(deadline:number,now:number) {
  return Math.max(0,Math.ceil((deadline-now)/1000));
}

export function shareClock(seconds:number) {
  const value = Math.max(0,Math.ceil(seconds));
  return {days:Math.floor(value/86400),clock:[Math.floor(value/3600)%24,Math.floor(value/60)%60,value%60].map(n=>String(n).padStart(2,'0')).join(':')};
}

export function diaryExcerpt(text = '', truncated = false) {
  const characters = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text.trim()), item => item.segment)
    : Array.from(text.trim());
  const safe = truncated ? characters.slice(0,-1) : characters;
  return safe.slice(0,120).join('') + (characters.length > 120 || truncated ? '…' : '');
}
