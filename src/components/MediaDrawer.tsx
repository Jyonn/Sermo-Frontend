import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import {showToast} from '../lib/toast';
import {claimMediaPlayback, releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {useMediaSource} from '../lib/useMediaSource';
import {downloadMedia, mediaFile, saveMediaFile} from '../lib/downloadMedia';
import {copyText} from '../lib/presentation';
import type {ImageMetadataDTO, TinyUserDTO} from '../types';
import {ActionSheet} from './ActionSheet';
import {FloatingDrawerScope} from './DesktopPanelWorkspace';
import {MediaMetadataPanel} from './MediaMetadataPanel';
import {MediaWaitFeedback} from './MediaWaitFeedback';
import {DrawerDismissButton, OverlayIconButton} from './OverlayIconButton';
import {SideDrawer} from './SideDrawer';
import {UserAvatar} from './UserAvatar';
import {useMediaDrawerGestures} from './useMediaDrawerGestures';
import './MediaDrawer.css';

export interface MediaLightboxItem {
  id?: number | string;
  uri: string;
  kind: 'image' | 'video';
  posterUri?: string | null;
  thumbnailUri?: string | null;
  width?: number | null;
  height?: number | null;
  detail?: ReactNode;
  imageMetadata?: ImageMetadataDTO | null;
  owner?: TinyUserDTO | null;
  createdAt?: number;
  downloadLabel?: string;
  referrerPolicy?: 'no-referrer';
  loop?: boolean;
  autoPlay?: boolean;
  deferPlayback?: boolean;
  onPlayRequest?: () => void;
  onPlaybackError?: () => void;
}

interface MediaDrawerEditor {
  adjusting: boolean;
  busy?: boolean;
  sendDisabled?: boolean;
  submitLabel?: string;
  onSend: () => void;
  createShareFile?: () => Promise<File>;
  adjustDisabled?: boolean;
  onAdjust: () => void;
  onDone: () => void;
  onCancel: () => void;
  info: ReactNode;
  stage?: ReactNode;
  tools?: ReactNode;
  headerActions?: ReactNode;
  notice?: ReactNode;
}

export interface MediaLightboxProps {
  initialInfo?: boolean;
  fixedFitImage?: {overlay?: ReactNode; onReady: () => void; onError: () => void};
  index: number;
  items: MediaLightboxItem[];
  altPrefix?: string;
  sharedDetail?: ReactNode;
  source?: {name: string; logo?: string; url?: string; author?: string};
  fileNamePrefix?: string;
  historyKey?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  totalCount?: number;
  onApproachingEnd?: () => void;
  onJumpToMessage?: () => void;
  onApproachingStart?: () => void;
  onBoundary?: (direction: 'older' | 'newer') => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  loading?: boolean;
  navigationLabel?: string;
  editor?: MediaDrawerEditor;
}

const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
const closedVideo = {current: 0, duration: 0, playing: false, muted: false};
const timeCode = (time: number) => {
  const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export function MediaDrawer(props: MediaLightboxProps) {
  const item = props.items[props.index] ?? props.items[0];
  return item ? <MediaDrawerContent {...props} item={item}/> : null;
}

function MediaDrawerContent({
  item, index, items, altPrefix, editor, fixedFitImage, initialInfo, source: platform, sharedDetail,
  onClose, onIndexChange, onApproachingEnd, onApproachingStart, onJumpToMessage, onBoundary,
  hasNext, hasPrevious, loading, totalCount, navigationLabel, fileNamePrefix = 'frienden', historyKey,
}: MediaLightboxProps & {item: MediaLightboxItem}) {
  const {locale, t} = useI18n();
  const [mode, setMode] = useState<'default' | 'immersive'>('default');
  const [hideFilm, setHideFilm] = useState(false);
  const [info, setInfo] = useState(initialInfo || !item.uri && item.kind === 'image' && Boolean(sharedDetail));
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [dimensions, setDimensions] = useState({width: item.width ?? 0, height: item.height ?? 0});
  const [playback, setPlayback] = useState(closedVideo);
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const film = useRef<HTMLDivElement>(null);
  const filePosition = useRef({time: 0, playing: false});
  const videoIdentity = useRef<string>();
  const attemptedVideo = useRef(false);
  const reportedVideoFailure = useRef(false);
  const flashReady = useRef(false);
  const callback = useRef({onApproachingStart, onApproachingEnd});
  callback.current = {onApproachingStart, onApproachingEnd};
  const identity = String(item.id ?? `${index}:${item.uri}`);
  const videoItem = item.kind === 'video';
  const adjusting = editor?.adjusting === true;
  const immersive = mode === 'immersive' && !adjusting && !fixedFitImage;
  const interactionDisabled = adjusting || Boolean(fixedFitImage || editor?.busy);
  const statusText = videoItem ? t('media.video') : t('media.imagePreview');
  const title = altPrefix || statusText;
  const infoContent = editor?.info ?? <>{item.imageMetadata || initialInfo && item.kind === 'image' ? <MediaMetadataPanel kind="image" metadata={item.imageMetadata} owner={item.owner} /> : null}
    {item.detail}{sharedDetail}</>;
  const hasInfo = Boolean(editor || initialInfo || item.imageMetadata?.status === 1 || item.detail || sharedDetail || platform?.url);
  const infoOpen = info && hasInfo && !immersive && !adjusting && !fixedFitImage;
  const media = useMediaSource(fixedFitImage || editor ? '' : item.uri, undefined, item.kind);
  const src = fixedFitImage || editor ? item.uri : media.src;
  const go = (direction: -1 | 1) => {
    if (interactionDisabled || loading && (index + direction < 0 || index + direction >= items.length)) return;
    const next = index + direction;
    if (items[next]) onIndexChange(next);
    else if (direction < 0 ? hasPrevious : hasNext) onBoundary?.(direction < 0 ? 'older' : 'newer');
  };
  const toggleInfo = (open: boolean) => {if (hasInfo) setInfo(open);};
  const changeMode = (next: typeof mode, reason: 'zoom' | 'tap') => {
    setMode(next);
    if (next === 'default') setHideFilm(reason === 'tap');
  };
  const gestures = useMediaDrawerGestures({
    mediaKey: identity, size: dimensions, mode, disabled: interactionDisabled || !src,
    onMode: changeMode, onStep: go, onInfo: toggleInfo,
  });

  useLayoutEffect(() => {
    if (videoIdentity.current !== identity) {
      setHideFilm(false);
      filePosition.current = {time: 0, playing: Boolean(item.autoPlay)};
      setPlayback(current => ({...closedVideo, muted: current.muted}));
      videoIdentity.current = identity;
    }
    setFailed(false);
    setWaiting(false);
    attemptedVideo.current = Boolean(item.autoPlay);
    reportedVideoFailure.current = false;
    setDimensions({width: item.width ?? 0, height: item.height ?? 0});
    flashReady.current = false;
    const node = image.current;
    if (node?.complete && node.naturalWidth) setDimensions({width: node.naturalWidth, height: node.naturalHeight});
  }, [identity, src]);

  useEffect(() => {
    if (!fixedFitImage || !src || !gestures.fitted.width || flashReady.current || !image.current?.naturalWidth) return;
    flashReady.current = true;
    fixedFitImage.onReady();
  }, [fixedFitImage, gestures.fitted.width, src]);
  useEffect(() => {
    if (index < 4) callback.current.onApproachingStart?.();
    if (items.length - index < 5) callback.current.onApproachingEnd?.();
  }, [index, items.length]);
  useEffect(() => {
    const selected = film.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (selected && film.current) film.current.scrollLeft = selected.offsetLeft + selected.offsetWidth / 2 - film.current.clientWidth / 2;
  }, [index, immersive, adjusting, infoOpen, hideFilm, items.length]);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    return () => {releaseMediaPlayback(node); node.pause();};
  }, [videoItem, src]);

  const dismiss = () => {
    if (editor?.busy) return;
    if (adjusting) editor.onCancel();
    else onClose();
  };
  const videoError = () => {
    if (!item.onPlaybackError) {media.fail(); return;}
    if (!attemptedVideo.current || reportedVideoFailure.current) return;
    reportedVideoFailure.current = true;
    setWaiting(false);
    setFailed(true);
    item.onPlaybackError();
  };
  const play = () => {
    if (!src) {item.onPlayRequest?.(); return;}
    const node = video.current;
    if (!node) return;
    if (node.paused) {
      attemptedVideo.current = true;
      setWaiting(true);
      void node.play().catch(error => {
        if (node !== video.current || error instanceof DOMException && error.name === 'AbortError') return;
        setWaiting(false);
        videoError();
      });
    }
    else node.pause();
  };
  const updatePlayback = (node: HTMLVideoElement) => {
    const timing = {current: node.currentTime, duration: Number.isFinite(node.duration) ? node.duration : 0};
    filePosition.current = {time: node.currentTime, playing: !node.paused};
    setPlayback({...timing, playing: !node.paused, muted: node.muted});
  };
  const shareNative = async () => {
    setShareOpen(false);
    setSharing(true);
    try {
      if (platform?.url) {
        if (navigator.share) await navigator.share({title, url: platform.url});
        else {await copyText(platform.url); showToast(t('mediaDrawer.linkCopied'));}
      } else {
        const file = editor?.createShareFile ? await editor.createShareFile() : await mediaFile(src, fileNamePrefix);
        if (navigator.canShare?.({files: [file]})) {
          try {await navigator.share({files: [file]});}
          catch (error) {if (error instanceof DOMException && error.name === 'NotAllowedError') saveMediaFile(file); else throw error;}
        } else saveMediaFile(file);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) showToast(t('media.downloadFailed'), 'info');
    } finally {setSharing(false);}
  };
  const download = () => {
    setShareOpen(false);
    const saving = editor?.createShareFile ? editor.createShareFile().then(saveMediaFile) : downloadMedia(src, fileNamePrefix);
    void saving.catch(error => showToast(t(error instanceof Error && error.message === 'media_processing'
      ? 'media.downloadProcessing' : 'media.downloadFailed'), 'info'));
  };
  const date = item.createdAt ? new Date(item.createdAt * 1000) : null;
  const dimmed = immersive || adjusting;
  const loadingPhase = fixedFitImage || editor
    ? (gestures.fitted.width || adjusting ? 'idle' : 'loading')
    : media.phase;
  const scaleStyle = {width: gestures.fitted.width || '100%', height: gestures.fitted.height || '100%',
    transform: `translate3d(calc(-50% + ${gestures.transform.x}px), calc(-50% + ${gestures.transform.y}px), 0) scale(${gestures.transform.scale})`};
  const filmStrip = items.length > 1 || hasPrevious || hasNext ? <div className="media-drawer-film" ref={film} aria-label={t('mediaDrawer.thumbnails')}>
    {hasPrevious && <OverlayIconButton icon="chevron_left" aria-label={t('media.previousImage')} onClick={() => go(-1)} disabled={loading} />}
    {items.map((entry, position) => {
      const thumb = entry.thumbnailUri || entry.posterUri || (entry.kind === 'image' && Math.abs(position - index) <= 6 ? entry.uri : '');
      return <button type="button" key={entry.id ?? `${position}:${entry.uri}`} aria-current={index === position ? 'true' : undefined}
        aria-label={t('mediaDrawer.asset', {count: position + 1})} disabled={editor?.busy} onClick={() => onIndexChange(position)}>
        {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy={entry.referrerPolicy} /> : icon(entry.kind === 'video' ? 'movie' : 'photo')}
        {thumb && entry.kind === 'video' && <span className="media-drawer-film-video">{icon('play_arrow')}</span>}
      </button>;
    })}
    {hasNext && <OverlayIconButton icon="chevron_right" aria-label={t('media.nextImage')} onClick={() => go(1)} disabled={loading} />}
  </div> : null;

  return <FloatingDrawerScope standalone>
    <SideDrawer open fullscreen headerless floatingBack={false} trapFocus historyMode={historyKey ? 'stack' : 'route'} historyKey={historyKey}
      backdropClassName="media-drawer-backdrop"
      className={`media-drawer${dimmed ? ' is-dark-media' : ''}`} title={title} onClose={dismiss}>
      <section className={`media-drawer-layout${infoOpen ? ' has-media-info' : ''}${adjusting ? ' is-adjusting' : ''}${immersive ? ' is-immersive-media' : ''}${fixedFitImage ? ' is-flash-media' : ''}`}
        onKeyDown={event => {
          if ((event.target as HTMLElement).closest('input,textarea,select,button,a') || interactionDisabled) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); go(event.key === 'ArrowLeft' ? -1 : 1);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            gestures.reset();
            setInfo(false);
            changeMode(immersive ? 'default' : 'immersive', 'tap');
          }
        }}>
        <div className={`media-drawer-stage${gestures.dragging ? ' is-dragging' : ''}`} tabIndex={interactionDisabled ? undefined : 0}
          aria-label={adjusting ? undefined : t('photo.canvas')} ref={gestures.stage} {...gestures.events}>
          {adjusting ? editor.stage : <>
            {videoItem && src ? <video key={src} ref={video} className="media-drawer-canvas" style={infoOpen ? undefined : scaleStyle} src={src}
              poster={item.posterUri ?? undefined} playsInline preload={item.deferPlayback ? 'none' : 'metadata'} loop={item.loop} muted={playback.muted}
              onLoadedMetadata={event => {
                const node = event.currentTarget;
                setDimensions({width: node.videoWidth, height: node.videoHeight});
                if (filePosition.current.time && Number.isFinite(node.duration)) node.currentTime = Math.min(node.duration, filePosition.current.time);
                if (filePosition.current.playing) void node.play().catch(() => undefined);
                updatePlayback(node);
              }}
              onCanPlay={() => {setWaiting(false); media.ready();}}
              onWaiting={event => {if (!event.currentTarget.paused) setWaiting(true);}}
              onPlaying={() => setWaiting(false)}
              onTimeUpdate={event => updatePlayback(event.currentTarget)}
              onDurationChange={event => {
                const duration = event.currentTarget.duration;
                if (Number.isFinite(duration)) setPlayback(value => ({...value, duration}));
              }}
              onPlay={event => {claimMediaPlayback(event.currentTarget); updatePlayback(event.currentTarget);}}
              onPause={event => {setWaiting(false); releaseMediaPlayback(event.currentTarget); updatePlayback(event.currentTarget);}}
              onEnded={event => updatePlayback(event.currentTarget)}
              onError={videoError} /> : null}
            {!videoItem && src ? <img key={src} ref={image} className="media-drawer-canvas" style={infoOpen ? undefined : scaleStyle} src={src}
              alt={title} draggable={false} referrerPolicy={item.referrerPolicy}
              onContextMenu={fixedFitImage ? event => event.preventDefault() : undefined}
              onLoad={event => {
                setDimensions({width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight});
                if (!fixedFitImage && !editor) media.ready();
              }}
              onError={fixedFitImage?.onError ?? (editor ? () => setFailed(true) : media.fail)} /> : null}
            {videoItem && !src && item.posterUri ? <img className="media-drawer-poster" alt="" src={item.posterUri} referrerPolicy={item.referrerPolicy} /> : null}
            {src && (!item.deferPlayback || attemptedVideo.current) && <MediaWaitFeedback phase={failed ? 'error' : waiting ? 'buffering' : loadingPhase}
              onRetry={fixedFitImage || editor || item.onPlaybackError ? undefined : media.retry} />}
            {fixedFitImage && !src && <MediaWaitFeedback phase="loading" />}
            {videoItem && !playback.playing && (src && !failed || item.onPlayRequest) && <OverlayIconButton icon="play_arrow"
              className="media-drawer-play" aria-label={t('media.play')} onClick={play} />}
          </>}
        </div>

        <header className="media-drawer-top" aria-label={adjusting ? t('photo.edit') : undefined}>
          <DrawerDismissButton className="media-drawer-dismiss" disabled={editor?.busy} onClick={dismiss} />
          {adjusting && <div className="media-drawer-editor-actions">{editor.headerActions}</div>}
          {!immersive && !adjusting && <div className="media-drawer-identity">
            {!adjusting && item.owner && <UserAvatar className="media-drawer-avatar" name={item.owner.name}
              uri={item.owner.avatar_uri} cacheKey={item.owner.avatar_cache_key} />}
            {!adjusting && !item.owner && platform?.logo && <img className="media-drawer-avatar" src={platform.logo} alt="" />}
            <div>
              <strong>{item.owner?.name || platform?.author || platform?.name || title}</strong>
              {!adjusting && date && Number.isFinite(date.getTime()) ? <time dateTime={date.toISOString()}>
                {new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}).format(date)}
              </time> : !fixedFitImage && !adjusting && (items.length > 1 || totalCount) ? <small>{navigationLabel ?? `${index + 1} / ${totalCount ?? items.length}`}</small> : null}
            </div>
          </div>}
          <div className="media-drawer-top-actions">
            {fixedFitImage?.overlay}

            {adjusting ? <button className="media-drawer-done" type="button" onClick={editor.onDone}>{t('common.done')}</button> : null}
            {editor && !adjusting && !immersive && <OverlayIconButton icon={editor.busy ? 'progress_activity' : editor.submitLabel ? 'check' : 'send'} aria-label={editor.submitLabel || t('common.send')}
              disabled={editor.busy || editor.sendDisabled} onClick={editor.onSend} />}
          </div>
        </header>

        {infoOpen ? <section className="media-drawer-info" aria-label={t('mediaDrawer.info')}>
          <button className="media-drawer-handle" type="button" onClick={() => setInfo(false)} aria-label={t('common.close')}><span/></button>
          {platform?.url ? <a className="media-drawer-source" href={platform.url} target="_blank" rel="noreferrer">
            {platform.logo && <img src={platform.logo} alt="" />}{platform.name}{icon('north_east')}
          </a> : null}
          {infoContent}
        </section> : null}

        {!fixedFitImage && !infoOpen && <footer className="media-drawer-bottom">
          {adjusting ? editor.tools : <>
            {videoItem && src && <div className="media-drawer-transport">
              <OverlayIconButton icon={playback.playing ? 'pause' : 'play_arrow'} aria-label={t(playback.playing ? 'media.pause' : 'media.play')} onClick={play} />
              <input type="range" min={0} max={playback.duration || 1} step={.01} value={Math.min(playback.current, playback.duration)}
                disabled={!playback.duration} aria-label={t('mediaDrawer.seek')}
                onChange={event => {if (video.current) {video.current.currentTime = event.currentTarget.valueAsNumber; updatePlayback(video.current);}}} />
              <span>{timeCode(playback.current)} / {timeCode(playback.duration)}</span>
              <OverlayIconButton icon={playback.muted ? 'volume_off' : 'volume_up'} aria-label={t(playback.muted ? 'mediaDrawer.unmute' : 'mediaDrawer.mute')}
                onClick={() => {if (video.current) {video.current.muted = !video.current.muted; updatePlayback(video.current);}}} />
            </div>}
            {!immersive && !hideFilm && filmStrip}
            {!immersive && <div className="media-drawer-footer-actions">
              {(editor ? editor.createShareFile : src || platform?.url || onJumpToMessage) && <OverlayIconButton icon="ios_share" aria-label={t('square.share')}
                onClick={() => setShareOpen(true)} disabled={sharing} />}
              {editor && <OverlayIconButton icon="tune" className="media-drawer-adjust" aria-label={t('mediaDrawer.adjust')}
                disabled={editor.busy || editor.adjustDisabled || !src} onClick={editor.onAdjust} />}
              {hasInfo && <OverlayIconButton icon="info" className="media-drawer-info-action" aria-label={t('mediaDrawer.info')} onClick={() => setInfo(true)} />}
            </div>}
          </>}
        </footer>}
        {editor?.notice}
      </section>
      <ActionSheet open={shareOpen} title={t('square.share')} onClose={() => setShareOpen(false)} actions={[
        ...(src || platform?.url ? [{key: 'share', label: t('square.share'), icon: icon('ios_share'), onSelect: () => void shareNative()}] : []),
        ...(src ? [{key: 'save', label: item.downloadLabel ? `${t('common.download')} · ${item.downloadLabel}` : t('common.download'), icon: icon('download'), onSelect: download}] : []),
        ...(onJumpToMessage ? [{key: 'jump', label: t('messageSearch.jumpToMessage'), icon: icon('my_location'), onSelect: onJumpToMessage}] : []),
      ]} />
    </SideDrawer>
  </FloatingDrawerScope>;
}
