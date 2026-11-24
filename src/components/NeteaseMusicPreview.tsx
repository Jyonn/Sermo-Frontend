import { useMemo, useState, type CSSProperties } from "react";
import { useI18n } from "../lib/language";
import { useMusicPlayer } from "../lib/musicPlayer";
import { musicBrand, sameMusic } from "../lib/musicBrand";
import type { MusicProviderDataDTO } from "../types";
import {MusicPlayerDrawer} from './MusicPlayerDrawer';
import {isPockloSong,songPresentation} from '../lib/pockloSong';
import {useSongMetadata} from '../lib/pockloSongResource';
import type {MusicSource} from '../lib/recordShopPlayback';

interface NeteaseMusicPreviewProps {
  music: MusicProviderDataDTO;
  source?: MusicSource;
}

export function isMusicData(value: unknown): value is MusicProviderDataDTO {
  if(isPockloSong(value))return true;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MusicProviderDataDTO>;
  return ["netease_music", "qq_music", "kugou_music", "qishui_music", "apple_music", "kuwo_music"].includes(String(candidate.provider))
    && ["number", "string"].includes(typeof candidate.song_id)
    && typeof candidate.title === "string"
    && typeof candidate.audio_url === "string"
    && typeof candidate.canonical_url === "string"
    && Array.isArray(candidate.artists);
}

export function MusicPreview({ music: supplied, source }: NeteaseMusicPreviewProps) {
  const { t } = useI18n();
  const player = useMusicPlayer();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const metadata=useSongMetadata(isPockloSong(supplied)?supplied:null,drawerOpen);
  const baseMusic=sameMusic(player.music,supplied)&&player.music?.provider==='pocklo_music'?player.music:supplied;
  const music:MusicProviderDataDTO=useMemo(()=>metadata.song?{...baseMusic,...songPresentation(metadata.song)}:baseMusic,[baseMusic,metadata.song]);
  const [failedCover,setFailedCover]=useState<string>();
  const brand = musicBrand(music.provider);
  const active = sameMusic(player.music, music);
  const playing = active && player.playing;
  const currentTime = active ? player.time : 0;
  const duration = active ? player.duration : (music.duration_ms || 0) / 1000;
  const audioUnavailable = music.provider==='pocklo_music'?(active&&(player.songError===404||player.songError===410)):!music.audio_url || (active && player.unavailable);
  const artists = music.artists.join(" / ") || (music.provider==='pocklo_music'?t('pocklo.unknownArtist'):'');

  const togglePlayback = () => player.play(music,source);
  const seek = (value: number) => { if (!active) player.play(music,source); player.seek(value); };

  const cover = music.cover_url&&failedCover!==music.cover_url ? <img alt="" src={music.cover_url} onError={()=>setFailedCover(music.cover_url)} /> : <span className="material-symbols-outlined">music_note</span>;

  return (
    <>
      <article className="netease-music-card" onClick={(event) => event.stopPropagation()} style={{ "--netease-red": brand.color } as CSSProperties}>
        <button
          aria-label={playing ? t("music.pause") : t("music.play")}
          className="netease-music-play"
          disabled={audioUnavailable}
          onClick={() => void togglePlayback()}
          type="button"
        >
          <span className={`netease-music-cover music-disc${active ? " is-active" : ""}${playing ? " is-playing" : ""}`}>{cover}</span>
          <span className="netease-music-play-icon material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
        </button>
        <button className="netease-music-summary" onClick={() => setDrawerOpen(true)} type="button">
          <strong title={music.title}>{music.title}</strong>
          {artists?<><i aria-hidden="true">·</i><span title={artists}>{artists}</span></>:null}
        </button>
        <button className="netease-music-source" onClick={() => setDrawerOpen(true)} type="button">
          <img alt="" src={brand.logo}/>
          <span>{music.provider==='pocklo_music'?t('pocklo.musicCardSource'):brand.name}</span>
        </button>
        <span className="netease-music-card-progress" style={{ "--music-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
      </article>
      <MusicPlayerDrawer
        music={music}
        historyKey={`${music.provider}-song-${music.song_id}`}
        onClose={() => setDrawerOpen(false)}
        onRouteOpen={() => setDrawerOpen(true)}
        open={drawerOpen}
        playing={playing} time={currentTime} duration={duration} loading={active && player.loading}
        unavailable={audioUnavailable || (active && player.unavailable)} songError={active ? player.songError : 0}
        metadataLoading={metadata.loading} metadataError={metadata.error ?? undefined}
        onToggle={togglePlayback} onSeek={seek}
      />
    </>
  );
}
