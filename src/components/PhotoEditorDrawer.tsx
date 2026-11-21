import {useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {useI18n, type TranslationKey} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import {centeredPhotoCrop, clampPhoto, decodePhoto, exportPhoto, flipPhoto, fullPhoto, initialPhotoEdit, paintPhoto, photoLayers, photoSourcePoint, rotatePhoto, type PhotoEdit, type PhotoPoint, type PhotoRect} from '../lib/photoEdit';
import {readPhotoMetadata, type PhotoMetadata} from '../lib/photoMetadata';
import {SideDrawer} from './SideDrawer';
import './PhotoEditorDrawer.css';

type Tool = 'crop' | 'rotate' | 'mosaic' | 'privacy' | 'flash';
const tools = [
  ['crop', 'crop'], ['rotate', 'rotate_right'], ['mosaic', 'grid_on'],
  ['privacy', 'shield'], ['flash', 'bolt'],
] as const;
type Draft = {file: File; id: string; edit: PhotoEdit; history: PhotoEdit[]; sent: boolean; skipped?: boolean};
type Gesture =
  | {type: 'swipe'; start: PhotoPoint}
  | {type: 'crop'; start: PhotoPoint; crop: PhotoRect; edge: string}
  | {type: 'pinch'; center: PhotoPoint; span: number; crop: PhotoRect; anchor: PhotoPoint}
  | {type: 'brush'; pointer: number};

function Icon({name}: {name: string}) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function Action({icon, label, onClick, pressed}: {icon: string; label: string; onClick: () => void; pressed?: boolean}) {
  return <button type="button" className="photo-editor-action" aria-pressed={pressed} onClick={onClick}><Icon name={icon}/>{label}</button>;
}

function Check({checked, onChange, children, disabled}: {checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean}) {
  return <label className="photo-editor-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/>{children}</label>;
}

export function PhotoEditorDrawer({files, onClose, onComplete, onSend}: {
  files: File[];
  onClose: () => void;
  onComplete?: () => void;
  onSend: (file: File, flash: boolean, id: string) => Promise<void>;
}) {
  const {t} = useI18n();
  const [drafts, setDrafts] = useState<Draft[]>(() => files.map(file => ({file, id: `photo:${crypto.randomUUID()}`, edit: initialPhotoEdit(), history: [], sent: false})));
  const [uris, setUris] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('crop');
  const [brush, setBrush] = useState(.09);
  const [surface, setSurface] = useState({width: 1, height: 1});
  const [loaded, setLoaded] = useState<{index: number; image: HTMLImageElement; layers: ReturnType<typeof photoLayers>}>();
  const [metadata, setMetadata] = useState<{index: number; data: PhotoMetadata}>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<{current: number; total: number}>();
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const discardDialog = useRef<HTMLDivElement>(null);
  const stageSwipe = useRef<PhotoPoint>();
  const pointers = useRef(new Map<number, PhotoPoint>());
  const gesture = useRef<Gesture>();
  const original = useRef<PhotoEdit>();
  const sending = useRef(false);
  const active = useRef(true);
  const draft = drafts[index];
  const {edit} = draft;
  const ready = loaded?.index === index ? loaded : undefined;
  const currentMetadata = metadata?.index === index ? metadata.data : undefined;
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
  }, []);

  useEffect(() => {
    if (!uris[index]) return;
    let current = true;
    setLoadFailed(false);
    void decodePhoto(uris[index]).then(image => {
      if (current) setLoaded({index, image, layers: photoLayers(image, 1280)});
    }).catch(() => {if (current) setLoadFailed(true);});
    void readPhotoMetadata(draft.file).then(data => {if (current) setMetadata({index, data});});
    return () => {current = false;};
  }, [uris, index, draft.file]);

  useLayoutEffect(() => {
    if (ready && canvas.current) paintPhoto(canvas.current, ready.layers, edit);
  }, [ready, edit]);

  useEffect(() => {
    document.getElementById(`photo-editor-thumb-${draft.id}`)?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }, [draft.id]);

  const update = (change: (edit: PhotoEdit) => PhotoEdit, remember = true) => setDrafts(items =>
    items.map((item, i) => i === index ? {...item, edit: change(item.edit),
      history: remember ? [...item.history.slice(-29), item.edit] : item.history} : item),
  );

  const undo = () => setDrafts(items => items.map((item, i) => {
    if (i !== index || !item.history.length) return item;
    return {...item, edit: item.history[item.history.length - 1], history: item.history.slice(0, -1)};
  }));

  const switchPhoto = (next: number) => {
    if (sending.current || next < 0 || next >= drafts.length || next === index) return;
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

  const swipe = (start: PhotoPoint, event: PointerEvent) => {
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) switchPhoto(index + (dx < 0 ? 1 : -1));
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
    if (pointers.current.size === 2 && tool !== 'mosaic') {
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
      update(value => ({...value, strokes: [...value.strokes, {points: [photoSourcePoint(p, value)], diameter: brush}]}));
    } else {
      const target = event.target as HTMLElement;
      const edge = target.closest<HTMLElement>('[data-photo-edge]')?.dataset.photoEdge;
      if (tool === 'crop' && (edge || (edit.crop.width < .99 || edit.crop.height < .99) && target.closest('.photo-editor-crop'))) {
        original.current = edit;
        gesture.current = {type: 'crop', start: p, crop: edit.crop, edge: edge ?? ''};
      } else gesture.current = {type: 'swipe', start: {x: event.clientX, y: event.clientY}};
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
      const scale = action.span / Math.max(.02, Math.hypot(a.x - b.x, a.y - b.y));
      const crop = centeredPhotoCrop(action.crop, action.crop.width * scale, action.crop.height * scale, action.anchor,
        {x: action.center.x - (a.x + b.x) / 2, y: action.center.y - (a.y + b.y) / 2});
      update(value => ({...value, crop}), false);
    } else if (action.type === 'crop') {
      const {crop, edge, start} = action;
      const dx = p.x - start.x, dy = p.y - start.y;
      let next = centeredPhotoCrop(crop, crop.width, crop.height, undefined, {x: dx, y: dy});
      if (edge) {
        const left = edge.includes('w') ? clampPhoto(crop.x + dx, 0, crop.x + crop.width - .04) : crop.x;
        const top = edge.includes('n') ? clampPhoto(crop.y + dy, 0, crop.y + crop.height - .04) : crop.y;
        const right = edge.includes('e') ? clampPhoto(crop.x + crop.width + dx, left + .04, 1) : crop.x + crop.width;
        const bottom = edge.includes('s') ? clampPhoto(crop.y + crop.height + dy, top + .04, 1) : crop.y + crop.height;
        next = {x: left, y: top, width: right - left, height: bottom - top};
      }
      update(value => ({...value, crop: next}), false);
    } else if (action.type === 'brush' && action.pointer === event.pointerId) {
      update(value => {
        const strokes = value.strokes.slice();
        const last = strokes[strokes.length - 1];
        if (!last) return value;
        const next = photoSourcePoint({x: clampPhoto(p.x, 0, 1), y: clampPhoto(p.y, 0, 1)}, value);
        strokes[strokes.length - 1] = {...last, points: [...last.points, next]};
        return {...value, strokes};
      }, false);
    }
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const action = gesture.current;
    if (pointers.current.size) return;
    gesture.current = undefined;
    const before = original.current;
    original.current = undefined;
    if (before) setDrafts(items => items.map((item, i) => i === index && item.edit !== before
      ? {...item, history: [...item.history.slice(-29), before]} : item));
    if (event.type === 'pointerup' && action?.type === 'swipe') swipe(action.start, event);
  };

  const ratio = ready ? (edit.turns % 2 ? ready.image.naturalHeight / ready.image.naturalWidth : ready.image.naturalWidth / ready.image.naturalHeight) : 1;
  const stageWidth = Math.min(surface.width, surface.height * ratio);
  const selectRatio = (aspect?: number) => update(value => {
    if (!aspect) return {...value, crop: fullPhoto};
    const normalized = aspect / ratio;
    const crop = centeredPhotoCrop(fullPhoto, Math.min(1, normalized), Math.min(1, 1 / normalized));
    return {...value, crop};
  });

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
          const metadata = !item.edit.flash && (item.edit.keepLocation || item.edit.keepDescription)
            ? await readPhotoMetadata(item.file) : {};
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

  const locked = Boolean(progress) || draft.sent;
  const pendingCount = drafts.filter(item => !item.sent && !item.skipped).length;
  const skipPhoto = () => {
    setDrafts(items => items.map((item, i) => i === index ? {...item, skipped: true} : item));
    const next = drafts.findIndex((item, i) => i > index && !item.sent && !item.skipped);
    switchPhoto(next >= 0 ? next : drafts.findIndex((item, i) => i !== index && !item.sent && !item.skipped));
  };
  return <SideDrawer open headerless floatingBack={false} fullViewport trapFocus historyMode="route" className="photo-editor-drawer" title={t('photo.edit')} onClose={close}>
    <section className="photo-editor" onKeyDown={event => {
      if (event.target !== frame.current || progress) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        switchPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
      if (tool !== 'crop' || locked) return;
      if (event.key === '+' || event.key === '=' || event.key === '-') {
        event.preventDefault();
        const factor = event.key === '-' ? 1.12 : .89;
        update(value => ({...value, crop: centeredPhotoCrop(value.crop, value.crop.width * factor, value.crop.height * factor)}));
      }
    }}>
      <header className="photo-editor-header">
        <button type="button" className="photo-editor-icon" aria-label={t('common.cancel')} onClick={close} disabled={Boolean(progress)}><Icon name="close"/></button>
        <div><h2>{t('photo.edit')}</h2><small>{index + 1} / {drafts.length}</small></div>
        <button type="button" className="photo-editor-submit" disabled={Boolean(progress) || !pendingCount || !uris.length || loadFailed && !draft.skipped} onClick={() => void send()}>{progress ? `${progress.current} / ${progress.total}` : t('photo.send', {count: pendingCount})}<Icon name={progress ? 'progress_activity' : 'send'}/></button>
      </header>
      <div className="photo-editor-stage" ref={stage}
        onPointerDown={event => {
          if (event.target !== event.currentTarget || event.button !== 0 || drafts.length < 2) return;
          stageSwipe.current = {x: event.clientX, y: event.clientY};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event => {
          if (event.target === event.currentTarget && stageSwipe.current) swipe(stageSwipe.current, event);
          stageSwipe.current = undefined;
        }}
        onPointerCancel={() => {stageSwipe.current = undefined;}}>
        {ready ? <div className="photo-editor-frame" ref={frame} tabIndex={0} aria-label={t('photo.canvas')}
          style={{width: stageWidth, height: stageWidth / ratio}} data-tool={tool}
          onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
          onWheel={event => {
            if (locked || tool !== 'crop') return;
            const factor = event.deltaY > 0 ? 1.1 : .91;
            update(value => ({...value, crop: centeredPhotoCrop(value.crop, value.crop.width * factor, value.crop.height * factor)}));
          }}>
          <canvas ref={canvas}/>
          {tool === 'crop' || edit.crop.width < 1 || edit.crop.height < 1 ? <div className="photo-editor-crop" data-active={tool === 'crop'}
            style={{left: `${edit.crop.x * 100}%`, top: `${edit.crop.y * 100}%`, width: `${edit.crop.width * 100}%`, height: `${edit.crop.height * 100}%`}}>
            {tool === 'crop' && ['nw','n','ne','e','se','s','sw','w'].map(edge => <i key={edge} data-photo-edge={edge}/>)}
          </div> : null}
        </div> : <div className="photo-editor-stage-status">
          <p role="status">{t(draft.skipped ? 'photo.skipped' : loadFailed ? 'photo.decodeFailed' : 'common.loading')}</p>
          {loadFailed && !draft.skipped && pendingCount > 1 && <Action icon="hide_image" label={t('photo.skip')} onClick={skipPhoto}/>}
        </div>}
        {drafts.length > 1 && [-1, 1].map(step => <button type="button" key={step} className={`photo-editor-nav is-${step < 0 ? 'prev' : 'next'}`}
          aria-label={t(step < 0 ? 'photo.previous' : 'photo.next')} onClick={() => switchPhoto(index + step)}
          disabled={Boolean(progress) || index + step < 0 || index + step >= drafts.length}><Icon name={step < 0 ? 'chevron_left' : 'chevron_right'}/></button>)}
      </div>
      {drafts.length > 1 && <nav className="photo-editor-film" aria-label={t('photo.photos')}>
        {drafts.map((item, i) => <button type="button" id={`photo-editor-thumb-${item.id}`} key={item.id} aria-current={i === index}
          aria-label={t('photo.select', {count: i + 1})} disabled={Boolean(progress)} onClick={() => switchPhoto(i)}>
          {uris[i] && <img src={uris[i]} alt="" draggable={false}/>}
          {(item.sent || item.skipped || item.edit.flash) && <Icon name={item.sent ? 'check' : item.skipped ? 'hide_image' : 'bolt'}/>}
        </button>)}
      </nav>}
      <div className="photo-editor-console">
        <div className="photo-editor-utilities">
          <button type="button" onClick={undo} disabled={locked || !draft.history.length}><Icon name="undo"/>{t('photo.undo')}</button>
          <button type="button" onClick={() => update(initialPhotoEdit)} disabled={locked || !draft.history.length}><Icon name="restart_alt"/>{t('avatar.cropReset')}</button>
        </div>
        {error && <p className="photo-editor-error" role="alert">{error}</p>}
        <fieldset className="photo-editor-tool-options" disabled={locked || !ready}>
          {tool === 'crop' && <><div className="photo-editor-actions">
            <Action icon="crop_free" label={t('photo.original')} onClick={() => selectRatio()}/>
            <Action icon="crop_square" label="1:1" onClick={() => selectRatio(1)}/>
            <Action icon="crop_portrait" label="4:5" onClick={() => selectRatio(.8)}/>
            <Action icon="crop_16_9" label="16:9" onClick={() => selectRatio(16 / 9)}/>
          </div><p>{t('photo.cropHelp')}</p></>}
          {tool === 'rotate' && <div className="photo-editor-actions">
            <Action icon="rotate_right" label={t('photo.turn')} onClick={() => update(rotatePhoto)}/>
            <Action icon="flip" label={t('photo.flipHorizontal')} onClick={() => update(value => flipPhoto(value, 'x'))}/>
            <Action icon="swap_vert" label={t('photo.flipVertical')} onClick={() => update(value => flipPhoto(value, 'y'))}/>
          </div>}
          {tool === 'mosaic' && <><div className="photo-editor-actions">
            {[.045, .09, .18].map((size, i) => <Action key={size} icon="circle" label={t((['photo.small','photo.medium','photo.large'] as const)[i])} pressed={brush === size} onClick={() => setBrush(size)}/>)}
          </div><p>{t('photo.mosaicHelp')}</p></>}
          {tool === 'privacy' && <><div className="photo-editor-actions">
            <Check checked={edit.keepLocation && !edit.flash} disabled={edit.flash || currentMetadata?.latitude === undefined} onChange={keepLocation => update(value => ({...value, keepLocation}))}><Icon name="location_on"/>{t('photo.keepLocation')}</Check>
            <Check checked={edit.keepDescription && !edit.flash} disabled={edit.flash || !currentMetadata?.description} onChange={keepDescription => update(value => ({...value, keepDescription}))}><Icon name="notes"/>{t('photo.keepDescription')}</Check>
          </div><p>{t(edit.flash ? 'photo.flashPrivacy' : 'photo.privacyHelp')}</p></>}
          {tool === 'flash' && <><div className="photo-editor-actions"><Check checked={edit.flash} onChange={flash => update(value => ({...value, flash}))}><Icon name="bolt"/>{t('photo.enableFlash')}</Check></div><p>{t('photo.flashHelp')}</p></>}
        </fieldset>
        <nav className="photo-editor-toolbar" aria-label={t('photo.edit')}>
          {tools.map(([key, icon]) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => setTool(key)}>
            <Icon name={icon}/><span>{t(`photo.${key}` as TranslationKey)}</span>
          </button>)}
        </nav>
      </div>
      {discard && <div ref={discardDialog} tabIndex={-1} className="photo-editor-discard" role="alertdialog" aria-modal="true" aria-label={t('photo.discard')}>
        <div><strong>{t('photo.discard')}</strong><button type="button" onClick={onClose}>{t('photo.discardChanges')}</button><button type="button" autoFocus onClick={() => setDiscard(false)}>{t('photo.continueEdit')}</button></div>
      </div>}
    </section>
  </SideDrawer>;
}
