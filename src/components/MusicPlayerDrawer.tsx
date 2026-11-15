import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import type {MusicProviderDataDTO} from '../types';
import {useI18n} from '../lib/language';
import {musicBrand} from '../lib/musicBrand';
import {lyricScrollTop, musicLyrics, musicTime} from '../lib/musicLyrics';
import {SideDrawer} from './SideDrawer';
import './MusicPlayerDrawer.css';

interface Props {
  music: MusicProviderDataDTO;
  open: boolean;
  historyKey: string;
  onClose: () => void;
  onRouteOpen: () => void;
  playing: boolean;
  time: number;
  duration: number;
  loading?: boolean;
  unavailable?: boolean;
  songError?: number;
  metadataLoading?: boolean;
  metadataError?: number;
  onToggle: () => void;
  onSeek: (time: number) => void;
}

export function MusicPlayerDrawer({music, open, historyKey, onClose, onRouteOpen, playing, time, duration, loading, unavailable, songError, metadataLoading, metadataError, onToggle, onSeek}: Props) {
  const {t} = useI18n();
  const brand = musicBrand(music.provider);
  const lyrics = useMemo(() => musicLyrics(music.lyrics), [music.lyrics]);
  const viewport = useRef<HTMLDivElement>(null);
  const lines = useRef(new Map<number, HTMLButtonElement>());
  const manualUntil = useRef(0);
  const [failedCover, setFailedCover] = useState('');
  const current = Math.max(0, Math.min(time, duration || time));
  const progress = duration > 0 ? Math.min(100, current / duration * 100) : 0;
  const failure = songError || metadataError;
  const terminal = failure === 404 || failure === 410;
  const disabled = terminal || (unavailable && !music.audio_url && music.provider !== 'pocklo_music');
  const activeIndex = useMemo(() => {
    for (let i = lyrics.length - 1; i >= 0; i--) if (time + .08 >= lyrics[i].time) return i;
    return -1;
  }, [lyrics, time]);

  useEffect(() => { if (open) manualUntil.current = 0; }, [open, music.provider, music.song_id]);
  useEffect(() => {
    const box = viewport.current, line = lines.current.get(activeIndex);
    if (!open || !box || !line || Date.now() < manualUntil.current) return;
    const top = line.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTo({top: lyricScrollTop(box.scrollTop, top, line.offsetHeight, box.clientHeight), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }, [open, activeIndex, lyrics]);

  const stopFollowing = () => { manualUntil.current = Date.now() + 4000; };
  const seek = (value: number) => { manualUntil.current = 0; onSeek(Math.max(0, Math.min(duration || 0, value))); };
  const playLabel = terminal ? t(failure === 404 ? 'pocklo.songRevoked' : 'pocklo.songMissing') : unavailable ? t('common.retry') : loading ? t('media.buffering') : t(playing ? 'music.pause' : 'music.play');
  const metadataMessage = metadataLoading ? t('common.loading') : metadataError ? t(metadataError === 404 ? 'pocklo.songRevoked' : metadataError === 410 ? 'pocklo.songMissing' : 'pocklo.songFailed') : '';

  return <SideDrawer className="netease-music-drawer" historyKey={historyKey} open={open} onClose={onClose} onRouteOpen={onRouteOpen} title={music.title} contentUnderToolbar
    style={{'--netease-red': brand.color} as CSSProperties}
    titleAccessory={<a className="music-player-source" href={music.canonical_url} target="_blank" rel="noopener noreferrer"><img src={brand.logo} alt=""/><span>{brand.name}</span><span className="material-symbols-outlined" aria-hidden="true">north_east</span></a>}>
    <div className="music-player-layout">
      <div className="music-player-record">
        <div className={`music-player-art music-disc is-active${playing && !loading ? ' is-playing' : ''}`}>
          {music.cover_url && failedCover !== music.cover_url ? <img alt="" src={music.cover_url} onError={() => setFailedCover(music.cover_url!)}/> : <span className="material-symbols-outlined" aria-hidden="true">music_note</span>}
        </div>
        <div className="music-player-identity">
          <h2 title={music.title}>{music.title}</h2>
          <p>{music.artists.join(' / ') || t('pocklo.unknownArtist')}</p>
          {music.album ? <small>{music.album}</small> : null}
        </div>
      </div>
      <div className="music-player-lyric-stage">
        <div className="music-player-lyrics" ref={viewport} role="region" aria-label={t('music.lyrics')} tabIndex={0} onWheel={stopFollowing} onTouchStart={stopFollowing} onPointerDown={stopFollowing} onKeyDown={event => {if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) stopFollowing();}}>
          {metadataMessage ? <div className="music-player-empty" role="status">{metadataMessage}</div> : lyrics.length ? lyrics.map((line, index) => <button type="button" key={`${line.time}:${index}`} disabled={disabled || !duration} className={`music-player-lyric${index === activeIndex ? ' is-current' : ''}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => seek(line.time)} ref={element => {if (element) lines.current.set(index, element); else lines.current.delete(index);}}><span>{line.text}</span>{line.translation ? <small>{line.translation}</small> : null}</button>) : music.lyrics?.original ? <div className="music-player-plain-lyrics">{music.lyrics.original}</div> : <div className="music-player-empty">{t('music.noLyrics')}</div>}
        </div>
      </div>
      <footer className="music-player-transport">
        <div className="music-player-seek" style={{'--music-progress': `${progress}%`} as CSSProperties}>
          <input type="range" min={0} max={duration || 0} step="0.1" value={Math.min(current, duration || 0)} disabled={!duration || disabled} onChange={event => seek(Number(event.target.value))} aria-label={t('music.progress')} aria-valuetext={`${musicTime(current)} / ${musicTime(duration)}`}/>
          <div className="music-player-times"><span>{musicTime(current)}</span><span>{musicTime(duration)}</span></div>
        </div>
        <div className="music-player-buttons">
          <button className="music-player-skip" type="button" onClick={() => seek(current - 10)} disabled={!duration || disabled} aria-label={t('music.backTen')}><span className="material-symbols-outlined" aria-hidden="true">replay_10</span></button>
          <button className="music-player-toggle" type="button" onClick={onToggle} disabled={disabled} aria-label={playLabel} aria-busy={loading || undefined}>{loading ? <span className="media-wait-spinner" aria-hidden="true"/> : <span className="material-symbols-outlined" aria-hidden="true">{unavailable && !terminal ? 'refresh' : playing ? 'pause' : 'play_arrow'}</span>}</button>
          <button className="music-player-skip" type="button" onClick={() => seek(current + 10)} disabled={!duration || disabled} aria-label={t('music.forwardTen')}><span className="material-symbols-outlined" aria-hidden="true">forward_10</span></button>
        </div>
        {unavailable || terminal ? <p className="music-player-playback-status" role="status">{terminal ? playLabel : t('music.audioUnavailable')}</p> : null}
      </footer>
    </div>
  </SideDrawer>;
}
