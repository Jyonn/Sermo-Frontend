import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '../lib/language';
import { avatarCropBounds, constrainAvatarCrop, exportAvatarCrop, hasTransparentPixels, initialAvatarCrop, resizeAvatarCrop, sizeAvatarCrop, type AvatarCrop, type AvatarImageSize } from '../lib/avatarCrop';
import { SideDrawer } from './SideDrawer';
import './AvatarCropDialog.css';

interface LoadedImage extends AvatarImageSize { element: HTMLImageElement; uri: string }
interface Props { file: File | null; busy: boolean; onClose: () => void; onConfirm: (file: File) => Promise<void> }

export function AvatarCropDialog({ file, busy, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [image, setImage] = useState<LoadedImage>();
  const [crop, setCrop] = useState<AvatarCrop>();
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState('checker');
  const [preview, setPreview] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; crop: AvatarCrop; corner: string; scale: number }>();
  const saving = busy || exporting;

  useEffect(() => {
    if (!file) { setImage(undefined); setCrop(undefined); return; }
    const uri = URL.createObjectURL(file);
    let active = true;
    setImage(undefined); setCrop(undefined); setError(false);
    const element = new Image();
    element.src = uri;
    void element.decode().then(() => {
      const width = element.naturalWidth, height = element.naturalHeight;
      if (!width || !height || width * height > 32_000_000) throw new Error('Invalid image dimensions');
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(element, 0, 0);
      let transparent = false;
      for (let y = 0; y < height && !transparent; y += 64) {
        transparent = hasTransparentPixels(context.getImageData(0, y, width, Math.min(64, height - y)).data);
      }
      canvas.width = canvas.height = 0;
      if (active) { const loaded = { element, width, height, transparent, uri }; setImage(loaded); setCrop(initialAvatarCrop(loaded)); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; URL.revokeObjectURL(uri); };
  }, [file]);

  useEffect(() => {
    if (!image || !crop || !previewCanvas.current) return;
    const canvas = previewCanvas.current;
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = 160 / crop.size;
    ctx.clearRect(0, 0, 160, 160);
    ctx.drawImage(image.element, -crop.x * scale, -crop.y * scale, image.width * scale, image.height * scale);
    setPreview(canvas.toDataURL('image/png'));
  }, [image, crop]);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || !crop || saving || event.button !== 0 || !stage.current || drag.current) return;
    const target = event.target as HTMLElement;
    const corner = target.closest<HTMLElement>('[data-corner]')?.dataset.corner ?? '';
    if (!corner && !target.closest('.avatar-crop-selection')) return;
    const bounds = avatarCropBounds(image);
    const stageSize = stage.current.getBoundingClientRect().width;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop, corner, scale: stageSize / Math.max(bounds.width, bounds.height) };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId || !image || saving) return;
    const dx = (event.clientX - active.x) / active.scale, dy = (event.clientY - active.y) / active.scale;
    setCrop(active.corner ? resizeAvatarCrop(image, active.crop, active.corner, dx, dy) : constrainAvatarCrop(image, { ...active.crop, x: active.crop.x + dx, y: active.crop.y + dy }));
  };
  const stop = (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.id === event.pointerId) drag.current = undefined; };
  const confirm = async () => {
    if (!image || !crop || saving) return;
    setExporting(true); setError(false);
    try { const output = await exportAvatarCrop(image.element, crop, image.transparent); await onConfirm(output); }
    catch { setError(true); }
    finally { setExporting(false); }
  };
  const bounds = image ? avatarCropBounds(image) : undefined;
  const world = bounds ? Math.max(bounds.width, bounds.height) : 1;
  const offsetX = image && bounds ? (world - bounds.width) / 2 - bounds.x : 0;
  const offsetY = image && bounds ? (world - bounds.height) / 2 - bounds.y : 0;
  const imageStyle = image ? { width: `${image.width / world * 100}%`, height: `${image.height / world * 100}%`, left: `${offsetX / world * 100}%`, top: `${offsetY / world * 100}%` } : undefined;
  const cropStyle = crop ? { width: `${crop.size / world * 100}%`, height: `${crop.size / world * 100}%`, left: `${(crop.x + offsetX) / world * 100}%`, top: `${(crop.y + offsetY) / world * 100}%` } : undefined;

  return <SideDrawer open={Boolean(file)} title={t('avatar.cropTitle')} historyKey="avatar-crop" trapFocus className="avatar-crop-drawer" onClose={() => { if (!saving) onClose(); }}>
    <div className="avatar-crop-editor">
      <div className="avatar-crop-intro"><h2>{t('avatar.cropTitle')}</h2><p>{t('avatar.cropHint')}</p></div>
      {image && crop && bounds ? <>
        <div className="avatar-crop-stage-wrap">
          <div ref={stage} className={`avatar-crop-stage${image.transparent ? ' is-transparent' : ''}`} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
            <img className="avatar-crop-source" alt="" draggable={false} src={image.uri} style={imageStyle} />
            <div className="avatar-crop-selection" style={cropStyle} role="group" tabIndex={0} aria-label={t('avatar.cropSelection')} onKeyDown={event => {
              if (saving || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
              event.preventDefault(); const step = event.shiftKey ? 1 : crop.size / 50;
              setCrop(constrainAvatarCrop(image, { ...crop, x: crop.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: crop.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) }));
            }}>
              <div className="avatar-crop-grid" aria-hidden="true" />
              {['nw','ne','sw','se'].map(corner => <span key={corner} className={`avatar-crop-handle is-${corner}`} data-corner={corner} aria-hidden="true" />)}
            </div>
          </div>
        </div>
        <div className="avatar-crop-range"><label htmlFor="avatar-crop-size">{t('avatar.cropRange')}</label><span>{Math.round(crop.size)} × {Math.round(crop.size)}</span><input id="avatar-crop-size" type="range" min={bounds.minSize} max={bounds.maxSize} step="any" disabled={saving} value={crop.size} onChange={event => setCrop(sizeAvatarCrop(image, crop, Number(event.target.value)))} /></div>
        <div className="avatar-crop-preview-row">
          <div className={`avatar-crop-preview is-${previewMode}`}><img src={preview} alt={t('avatar.cropPreview')} /></div>
          <div className="avatar-crop-preview-copy"><strong>{t('avatar.cropPreview')}</strong><span>{t(image.transparent ? 'avatar.cropTransparent' : 'avatar.cropOpaque')}</span>
            {image.transparent ? <div className="avatar-crop-surfaces" role="group" aria-label={t('avatar.cropPreviewBackground')}>{(['checker','light','dark'] as const).map(mode => <button type="button" key={mode} className={`is-${mode}`} aria-label={t(`avatar.cropBackground.${mode}`)} aria-pressed={previewMode === mode} onClick={() => setPreviewMode(mode)} />)}</div> : null}
          </div>
          <button className="avatar-crop-reset" type="button" disabled={saving} onClick={() => setCrop(initialAvatarCrop(image))}>{t('avatar.cropReset')}</button>
        </div>
      </> : <div className="avatar-crop-loading" role="status">{t(error ? 'avatar.cropFailed' : 'common.loading')}</div>}
      {error && image ? <p className="avatar-crop-error" role="alert">{t('avatar.cropFailed')}</p> : null}
      <div className="avatar-crop-footer"><button className="ghost-button" type="button" disabled={saving} onClick={onClose}>{t('common.cancel')}</button><button className="button" type="button" disabled={saving || !image} onClick={() => void confirm()}>{t(saving ? 'common.processing' : 'avatar.cropUse')}</button></div>
      <canvas ref={previewCanvas} hidden />
    </div>
  </SideDrawer>;
}
