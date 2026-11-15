import type { MusicProviderDataDTO } from '../types';
import {cueLines} from './pockloSong.ts';

export interface MusicLyricLine { time: number; text: string; translation?: string }

function parseLrc(value = ''): MusicLyricLine[] {
  return value.split(/\r?\n/).flatMap(row => {
    const text = row.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) return [];
    return [...row.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map(match => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] || '0').padEnd(3, '0').slice(0, 3)}`),
      text,
    }));
  }).sort((a, b) => a.time - b.time);
}

export function musicLyrics(lyrics: MusicProviderDataDTO['lyrics']): MusicLyricLine[] {
  if (lyrics?.cues?.length) return cueLines(lyrics.cues);
  const translations = new Map(parseLrc(lyrics?.translation).map(line => [line.time.toFixed(2), line.text]));
  return parseLrc(lyrics?.original).map(line => ({...line, translation: translations.get(line.time.toFixed(2))}));
}

/** Scroll only the lyric viewport, never the Drawer or the chat behind it. */
export function lyricScrollTop(current: number, lineOffset: number, lineHeight: number, viewportHeight: number) {
  return Math.max(0, current + lineOffset - (viewportHeight - lineHeight) / 2);
}

export function musicTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}
