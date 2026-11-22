import {useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {useI18n, type TranslationKey} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import {centeredPhotoCrop, clampPhoto, decodePhoto, exportPhoto, flipPhoto, fullPhoto, initialPhotoEdit, paintPhoto, photoFilters, photoLayers, photoSourcePoint, renderPhotoPreview, rotatePhoto, straightenPhoto, type PhotoEdit, type PhotoFilter, type PhotoPoint, type PhotoRect} from '../lib/photoEdit';
import {readPhotoMetadata, type PhotoMetadata} from '../lib/photoMetadata';
import {MediaDrawer} from './MediaDrawer';
import {OverlayIconButton} from './OverlayIconButton';
import './PhotoEditorDrawer.css';

type Tool = 'crop' | 'rotate' | 'mosaic' | 'filter';
const tools = [
  ['crop', 'crop'], ['mosaic', 'grid_on'], ['rotate', 'rotate_right'],
  ['filter', 'palette'],
] as const;
const ratios = [[9, 16], [4, 5], [5, 7], [3, 4], [3, 5], [2, 3]] as const;
type Preset = 'original' | 'free' | 'square' | number;
const filters = Object.keys(photoFilters) as PhotoFilter[];
type Draft = {file: File; id: string; edit: PhotoEdit; history: PhotoEdit[]; sent: boolean; skipped?: boolean};
type Gesture =
  | {type: 'crop'; start: PhotoPoint; crop: PhotoRect; edge: string}
  | {type: 'pinch'; center: PhotoPoint; span: number; crop: PhotoRect; anchor: PhotoPoint}
  | {type: 'brush'; pointer: number};

function Icon({name}: {name: string}) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function Check({checked, onChange, children, disabled}: {checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean}) {
  return <label className="photo-editor-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/>{children}</label>;
}

export function PhotoEditorDrawer({files, onClose, onComplete, onSend, allowFlash = true, submitLabel}: {
  files: File[];
  onClose: () => void;
  onComplete?: () => void;
  onSend: (file: File, flash: boolean, id: string) => Promise<void>;
  allowFlash?: boolean;
  submitLabel?: string;
}) {
  const {t} = useI18n();
  const [drafts, setDrafts] = useState<Draft[]>(() => files.map(file => ({file, id: `photo:${crypto.randomUUID()}`, edit: initialPhotoEdit(), history: [], sent: false})));
  const [uris, setUris] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('crop');
  const [adjusting, setAdjusting] = useState(false);
  const [preset, setPreset] = useState<Preset>('original');
  const [turnedRatio, setTurnedRatio] = useState(false);
  const [rendered, setRendered] = useState<{edit: PhotoEdit; uri: string}>();
  const [brush, setBrush] = useState(.09);
  const [surface, setSurface] = useState({width: 1, height: 1});
  const [loaded, setLoaded] = useState<{index: number; image: HTMLImageElement; layers: ReturnType<typeof photoLayers>}>();
  const [metadata, setMetadata] = useState(() => new Map<File, PhotoMetadata>());
  const metadataRequests = useRef(new WeakMap<File, Promise<PhotoMetadata>>());
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<{current: number; total: number}>();
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const discardDialog = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, PhotoPoint>());
  const gesture = useRef<Gesture>();
  const original = useRef<PhotoEdit>();
  const saved = useRef<{edit: PhotoEdit; history: PhotoEdit[]}>();
  const sliderStart = useRef<PhotoEdit>();
  const sending = useRef(false);
  const active = useRef(true);
  const draft = drafts[index];
  const {edit} = draft;
  const ready = loaded?.index === index ? loaded : undefined;
  const currentMetadata = metadata.get(draft.file);
  const dirty = drafts.some(item => !item.sent && !item.skipped && item.history.length > 0);
  useModalFocus(discardDialog, discard, () => setDiscard(false));

  useEffect(() => {
    active.current = true;
    const urls = files.map(file => URL.createObjectURL(file));
    setUris(urls);
    return () => {active.current = false; urls.forEach(url => URL.revokeObjectURL(url));};
  }, [files]);

  useLayoutEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setSurface({width: entry.contentRect.width, height: entry.contentRect.height}));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [adjusting]);

  useEffect(() => {
    if (!uris[index]) return;
    let current = true;
    setLoadFailed(false);
    void decodePhoto(uris[index]).then(image => {
      if (current) setLoaded({index, image, layers: photoLayers(image, 1280)});
    }).catch(() => {if (current) setLoadFailed(true);});
    return () => {current = false;};
  }, [uris, index]);

  useEffect(() => {
    let current = true;
    const loadNearbyMetadata = async () => {
      for (const position of [index, index - 1, index + 1]) {
        const file = files[position];
        if (!file) continue;
        let request = metadataRequests.current.get(file);
        if (!request) {
          request = readPhotoMetadata(file);
          metadataRequests.current.set(file, request);
        }
        const data = await request;
        if (!current) return;
        setMetadata(values => values.has(file) ? values : new Map(values).set(file, data));
      }
    };
    void loadNearbyMetadata();
    return () => {current = false;};
  }, [files, index]);

  const changedPixels = Boolean(edit.turns || edit.angle || edit.flipX || edit.flipY || edit.filter !== 'original'
    || edit.strokes.length || edit.crop.width !== 1 || edit.crop.height !== 1);
  useLayoutEffect(() => {
    if (adjusting && ready && canvas.current) paintPhoto(canvas.current, ready.layers, edit);
  }, [ready, edit, adjusting]);
  useEffect(() => {
    if (!ready || !changedPixels || adjusting) return;
    let live = true, uri = '';
    const preview = renderPhotoPreview(ready.image, edit, ready.layers).canvas;
    preview.toBlob(blob => {
      if (!live || !blob) return;
      uri = URL.createObjectURL(blob);
      setRendered({edit, uri});
    }, 'image/webp', .9);
    return () => {live = false; if (uri) URL.revokeObjectURL(uri);};
  }, [ready, edit, adjusting, changedPixels]);

  const update = (change: (edit: PhotoEdit) => PhotoEdit, remember = true) => setDrafts(items =>
    items.map((item, i) => i === index ? {...item, edit: change(item.edit),
      history: remember ? [...item.history.slice(-29), item.edit] : item.history} : item),
  );

  const undo = () => setDrafts(items => items.map((item, i) => {
    if (i !== index || !item.history.length) return item;
    return {...item, edit: item.history[item.history.length - 1], history: item.history.slice(0, -1)};
  }));

  const switchPhoto = (next: number) => {
    if (adjusting || sending.current || next < 0 || next >= drafts.length || next === index) return;
    pointers.current.clear();
    gesture.current = original.current = undefined;
    setError('');
    setIndex(next);
  };

  const close = () => {
    if (sending.current) return;
    if (discard) setDiscard(false);
    else if (dirty) setDiscard(true);
    else onClose();
  };

  const startAdjusting = () => {
    saved.current = {edit, history: draft.history};
    pointers.current.clear();
    original.current = gesture.current = undefined;
    setTool('crop');
    setPreset(edit.crop.width === 1 && edit.crop.height === 1 ? 'original' : 'free');
    setTurnedRatio(false);
    setAdjusting(true);
  };
  const finishAdjusting = () => {
    saved.current = undefined;
    pointers.current.clear();
    gesture.current = original.current = undefined;
    setAdjusting(false);
  };
  const cancelAdjusting = () => {
    const previous = saved.current;
    if (previous) setDrafts(items => items.map((item, position) => position === index ? {...item, ...previous} : item));
    finishAdjusting();
  };

  const point = (event: PointerEvent) => {
    const bounds = frame.current!.getBoundingClientRect();
    return {x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height};
  };

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || sending.current || draft.sent || event.button !== 0) return;
    const p = point(event);
    pointers.current.set(event.pointerId, p);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (pointers.current.size === 2 && tool === 'crop') {
      const [a, b] = [...pointers.current.values()];
      const center = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
      const {crop} = edit;
      original.current ??= edit;
      gesture.current = {type: 'pinch', center, crop, span: Math.max(.02, Math.hypot(a.x - b.x, a.y - b.y)),
        anchor: {x: clampPhoto((center.x - crop.x) / crop.width, 0, 1), y: clampPhoto((center.y - crop.y) / crop.height, 0, 1)}};
      return;
    }
    if (pointers.current.size > 1) return;
    if (tool === 'mosaic') {
      gesture.current = {type: 'brush', pointer: event.pointerId};
      update(value => ({...value, strokes: [...value.strokes, {points: [photoSourcePoint(p, value, ratio)],
        diameter: brush / straightenPhoto(value.angle, ratio).scale}]}));
    } else {
      const target = event.target as HTMLElement;
      const edge = target.closest<HTMLElement>('[data-photo-edge]')?.dataset.photoEdge;
      if (tool === 'crop' && (edge || (edit.crop.width < .99 || edit.crop.height < .99) && target.closest('.photo-editor-crop'))) {
        original.current = edit;
        gesture.current = {type: 'crop', start: p, crop: edit.crop, edge: edge ?? ''};
      }
    }
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current || !pointers.current.has(event.pointerId)) return;
    const p = point(event);
    pointers.current.set(event.pointerId, p);
    const action = gesture.current;
    if (action.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const scale = Math.min(1 / action.crop.width, 1 / action.crop.height,
        Math.max(.04 / action.crop.width, .04 / action.crop.height, action.span / Math.max(.02, Math.hypot(a.x - b.x, a.y - b.y))));
      const crop = centeredPhotoCrop(action.crop, action.crop.width * scale, action.crop.height * scale, action.anchor,
        {x: action.center.x - (a.x + b.x) / 2, y: action.center.y - (a.y + b.y) / 2});
      update(value => ({...value, crop}), false);
    } else if (action.type === 'crop') {
      const {crop, edge, start} = action;
      const dx = p.x - start.x, dy = p.y - start.y;
      let next = centeredPhotoCrop(crop, crop.width, crop.height, undefined, {x: dx, y: dy});
      if (edge && preset === 'free') {
        const left = edge.includes('w') ? clampPhoto(crop.x + dx, 0, crop.x + crop.width - .04) : crop.x;
        const top = edge.includes('n') ? clampPhoto(crop.y + dy, 0, crop.y + crop.height - .04) : crop.y;
        const right = edge.includes('e') ? clampPhoto(crop.x + crop.width + dx, left + .04, 1) : crop.x + crop.width;
        const bottom = edge.includes('s') ? clampPhoto(crop.y + crop.height + dy, top + .04, 1) : crop.y + crop.height;
        next = {x: left, y: top, width: right - left, height: bottom - top};
      } else if (edge) {
        const west = edge.includes('w'), north = edge.includes('n');
        const anchorX = west ? crop.x + crop.width : crop.x;
        const anchorY = north ? crop.y + crop.height : crop.y;
        const horizontal = (west ? -dx : dx) / crop.width;
        const vertical = (north ? -dy : dy) / crop.height;
        const growth = 1 + (Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical);
        const maximum = Math.min((west ? anchorX : 1 - anchorX) / crop.width, (north ? anchorY : 1 - anchorY) / crop.height);
        const scale = Math.min(maximum, Math.max(.04 / crop.width, .04 / crop.height, growth));
        const width = crop.width * scale, height = crop.height * scale;
        next = {x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height};
      }
      update(value => ({...value, crop: next}), false);
    } else if (action.type === 'brush' && action.pointer === event.pointerId) {
      update(value => {
        const strokes = value.strokes.slice();
        const last = strokes[strokes.length - 1];
        if (!last) return value;
        const next = photoSourcePoint({x: clampPhoto(p.x, 0, 1), y: clampPhoto(p.y, 0, 1)}, value, ratio);
        strokes[strokes.length - 1] = {...last, points: [...last.points, next]};
        return {...value, strokes};
      }, false);
    }
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size) return;
    gesture.current = undefined;
    const before = original.current;
    original.current = undefined;
    if (before) setDrafts(items => items.map((item, i) => i === index && item.edit !== before
      ? {...item, history: [...item.history.slice(-29), before]} : item));
  };

  const ratio = ready ? (edit.turns % 2 ? ready.image.naturalHeight / ready.image.naturalWidth : ready.image.naturalWidth / ready.image.naturalHeight) : 1;
  const stageWidth = Math.min(surface.width, surface.height * ratio);
  const ratioFor = (position: number, reverse = false) => {
    const [short, long] = ratios[position];
    return (ratio >= 1) !== reverse ? [long, short] : [short, long];
  };
  const selectRatio = (choice: Preset) => {
    const reverse = typeof choice === 'number' && preset === choice && !turnedRatio;
    setPreset(choice);
    setTurnedRatio(reverse);
    if (choice === 'free') return;
    if (choice === 'original') {update(value => ({...value, crop: fullPhoto})); return;}
    const [w, h] = choice === 'square' ? [1, 1] : ratioFor(choice, reverse);
    const normalized = w / h / ratio;
    update(value => ({...value, crop: centeredPhotoCrop(value.crop, Math.min(1, normalized), Math.min(1, 1 / normalized))}));
  };

  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setError('');
    const queue = drafts.map((item, position) => ({item, position})).filter(({item}) => !item.sent && !item.skipped);
    try {
      for (const [position, {item, position: photoIndex}] of queue.entries()) {
        setProgress({current: position + 1, total: queue.length});
        try {
          const image = await decodePhoto(uris[photoIndex]);
          const metadata = item.edit.flash ? {} : await readPhotoMetadata(item.file);
          const output = await exportPhoto(image, item.edit, metadata, item.file);
          if (!active.current) return;
          await onSend(output, item.edit.flash, item.id);
          if (!active.current) return;
          setDrafts(items => items.map((entry, i) => i === photoIndex ? {...entry, sent: true} : entry));
        } catch (cause) {
          if (active.current) {
            setIndex(photoIndex);
            setError(cause instanceof Error && 'identifier' in cause ? cause.message : t('photo.sendFailed'));
          }
          return;
        }
      }
      if (active.current) (onComplete ?? onClose)();
    } finally {
      sending.current = false;
      if (active.current) setProgress(undefined);
    }
  };

  const locked = Boolean(progress) || draft.sent || draft.skipped;
  const pendingCount = drafts.filter(item => !item.sent && !item.skipped).length;
  const skipPhoto = () => {
    setDrafts(items => items.map((item, i) => i === index ? {...item, skipped: true} : item));
    const next = drafts.findIndex((item, i) => i > index && !item.sent && !item.skipped);
    switchPhoto(next >= 0 ? next : drafts.findIndex((item, i) => i !== index && !item.sent && !item.skipped));
  };
  const editStage = <div className="photo-editor-stage" ref={stage}>
    {ready ? <div className="photo-editor-frame" ref={frame} tabIndex={0} aria-label={t('photo.canvas')}
      style={{width: stageWidth, height: stageWidth / ratio}} data-tool={tool}
      onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onKeyDown={event => {
        if (tool !== 'crop' || locked || !['+', '=', '-'].includes(event.key)) return;
        event.preventDefault();
        const factor = event.key === '-' ? 1.12 : .89;
        update(value => ({...value, crop: centeredPhotoCrop(value.crop, value.crop.width * factor, value.crop.height * factor)}));
      }}>
      <canvas ref={canvas} aria-hidden="true"/>
      {tool === 'crop' && <div className="photo-editor-crop" style={{
        left: edit.crop.x * 100 + '%', top: edit.crop.y * 100 + '%',
        width: edit.crop.width * 100 + '%', height: edit.crop.height * 100 + '%',
      }}>
        <div className="photo-editor-grid" aria-hidden="true" />
        {['nw', 'ne', 'sw', 'se'].map(edge => <span key={edge} data-photo-edge={edge} className={`photo-editor-corner ${edge}`} />)}
      </div>}
    </div> : <p role="status">{t(loadFailed ? 'photo.decodeFailed' : 'common.loading')}</p>}
  </div>;
  const toolbar = <div className="photo-editor-tools">
    {tool === 'crop' && <div className="photo-editor-ratios" aria-label={t('mediaDrawer.cropRatio')}>
      {(['original', 'free', 'square', ...ratios.map((_, position) => position)] as Preset[]).map(choice => (
        <button key={choice} type="button" aria-pressed={choice === preset} onClick={() => selectRatio(choice)}>
          {typeof choice === 'number' ? ratioFor(choice, preset === choice && turnedRatio).join(':')
            : t(choice === 'original' ? 'mediaDrawer.originalRatio' : choice === 'free' ? 'mediaDrawer.freeRatio' : 'mediaDrawer.squareRatio')}
        </button>
      ))}
    </div>}
    {tool === 'rotate' && <label className="photo-editor-scale">
      <output>{edit.angle}°</output>
      <input type="range" min={-45} max={45} step={1} value={edit.angle} aria-label={t('mediaDrawer.angle')}
        onPointerDown={event => {sliderStart.current = edit; event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerUp={() => {
          const previous = sliderStart.current;
          sliderStart.current = undefined;
          if (previous) setDrafts(items => items.map((item, i) => i === index && item.edit !== previous
            ? {...item, history: [...item.history.slice(-29), previous]} : item));
        }}
        onPointerCancel={() => {sliderStart.current = undefined;}}
        onDoubleClick={() => update(value => ({...value, angle: 0}))}
        onChange={event => {const angle = event.currentTarget.valueAsNumber; update(value => ({...value, angle}), !sliderStart.current);}} />
      <div className="photo-editor-ticks" aria-hidden="true"><span>−45°</span><span>0°</span><span>45°</span></div>
    </label>}
    {tool === 'mosaic' && <label className="photo-editor-scale">
      <output>{t('mediaDrawer.brushSize')}</output>
      <input type="range" min={3} max={24} step={1} value={Math.round(brush * 100)} aria-label={t('mediaDrawer.brushSize')}
        onChange={event => setBrush(event.currentTarget.valueAsNumber / 100)} />
      <div className="photo-editor-ticks" aria-hidden="true"><span>{t('photo.small')}</span><span>{t('photo.large')}</span></div>
    </label>}
    {tool === 'filter' && <div className="photo-editor-filters" aria-label={t('photo.filter')}>
      {filters.map(filter => <button key={filter} type="button" aria-pressed={edit.filter === filter} onClick={() => update(value => ({...value, filter}))}>
        <img src={uris[index]} alt="" style={{filter: photoFilters[filter]}} />
        <span>{t(`mediaDrawer.filter.${filter}` as TranslationKey)}</span>
      </button>)}
    </div>}
    <nav className="photo-editor-modes" aria-label={t('photo.edit')}>
      {tools.map(([key, icon]) => <button type="button" key={key} aria-pressed={tool === key} onClick={() => setTool(key)}>
        <Icon name={icon}/><span>{t(`photo.${key}` as TranslationKey)}</span>
      </button>)}
    </nav>
  </div>;
  const changeRotation = (change: (value: PhotoEdit) => PhotoEdit) => {
    update(change);
    setPreset('free');
  };
  const photoInfo = (position: number) => {
    const item = drafts[position];
    const {edit} = item;
    const disabled = Boolean(progress) || item.sent || item.skipped;
    const details = metadata.get(item.file);
    return <div className="photo-editor-info">
      <Check checked={edit.keepLocation} disabled={disabled || edit.flash} onChange={value => update(edit => ({...edit, keepLocation: value}))}>
        <span><strong>{t('photo.keepLocation')}</strong>
          {details?.latitude !== undefined && details.longitude !== undefined
            ? <small>{details.latitude.toFixed(4)}, {details.longitude.toFixed(4)}</small> : null}</span>
      </Check>
      <Check checked={edit.keepDescription} disabled={disabled || edit.flash} onChange={value => update(edit => ({...edit, keepDescription: value}))}>
        <span><strong>{t('photo.keepDescription')}</strong>{details?.description && <small>{details.description}</small>}</span>
      </Check>
      {allowFlash && <Check checked={edit.flash} disabled={disabled} onChange={value => update(edit => ({...edit, flash: value}))}>
        <span><strong>{t('photo.enableFlash')}</strong><small>{t('photo.flashHelp')}</small></span>
      </Check>}
      <p>{t(edit.flash ? 'photo.flashPrivacy' : 'photo.privacyHelp')}</p>
    </div>;
  };
  const activeUri = changedPixels ? rendered?.edit === edit ? rendered.uri : '' : uris[index] ?? '';
  return <MediaDrawer index={index} items={drafts.map((item, position) => ({
      id: item.id, kind: 'image', uri: position === index ? activeUri : uris[position] ?? '', thumbnailUri: uris[position],
    }))}
    altPrefix={t('photo.photos')} onClose={close} onIndexChange={switchPhoto}
    editor={{
      adjusting, busy: Boolean(progress), adjustDisabled: locked || loadFailed, sendDisabled: !pendingCount || !uris.length || loadFailed && !draft.skipped,
      submitLabel,
      createShareFile: !locked && !edit.flash && ready
        ? async () => exportPhoto(ready.image, edit, currentMetadata ?? await readPhotoMetadata(draft.file), draft.file)
        : undefined,
      onSend: () => void send(), onAdjust: startAdjusting, onDone: finishAdjusting, onCancel: cancelAdjusting,
      stage: editStage, tools: toolbar, info: photoInfo,
      headerActions: <>
        {tool === 'rotate' && !locked && <>
          <OverlayIconButton icon="flip" aria-label={t('photo.flipHorizontal')} onClick={() => changeRotation(value => flipPhoto(value, 'x'))} />
          <OverlayIconButton icon="rotate_90_degrees_cw" aria-label={t('photo.turn')} onClick={() => changeRotation(rotatePhoto)} />
        </>}
        <OverlayIconButton icon="undo" aria-label={t('photo.undo')} disabled={!draft.history.length || locked} onClick={undo} />
      </>,
      notice: <>
        {progress || error || loadFailed || draft.sent || draft.skipped ? <div className="photo-editor-notice" role={error ? 'alert' : 'status'}>
          {progress ? `${progress.current} / ${progress.total}` : error || t(draft.skipped ? 'photo.skipped' : draft.sent ? 'photo.sent' : 'photo.decodeFailed')}
          {loadFailed && !locked && <button type="button" onClick={skipPhoto}>{t('photo.skip')}</button>}
        </div> : null}
        {discard && <div ref={discardDialog} tabIndex={-1} className="photo-editor-discard" role="alertdialog" aria-modal="true" aria-label={t('photo.discard')}>
          <div><strong>{t('photo.discard')}</strong><button type="button" onClick={onClose}>{t('photo.discardChanges')}</button><button type="button" autoFocus onClick={() => setDiscard(false)}>{t('photo.continueEdit')}</button></div>
        </div>}
      </>,
    }} />;
}
