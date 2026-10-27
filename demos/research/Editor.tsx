import { useState, type ChangeEvent } from 'react';
import { Markdown } from './Markdown';
import { checkImages } from './model';
import { t } from './copy';
export async function readFile(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
export function Editor({ onSend, onCancel, label = t('update'), initial = '', pictures = true, retainAfterSend = false }: {
    onSend: (body: string, images: string[]) => void;
    onCancel?: () => void;
    label?: string;
    initial?: string;
    pictures?: boolean;
    retainAfterSend?: boolean;
}) {
    const [body, setBody] = useState(initial), [images, setImages] = useState<string[]>([]), [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function select(event: ChangeEvent<HTMLInputElement>) { const files = Array.from(event.target.files || []); event.target.value = ''; if (!checkImages(images.length, files.length) || files.some(f => !/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > 8 * 1024 * 1024)) {
        setError(t('imageLimit'));
        return;
    } setBusy(true); try {
        const values = await Promise.all(files.map(readFile));
        setImages(previous => [...previous, ...values]);
        setError('');
    }
    catch {
        setError(t('storageError'));
    }
    finally {
        setBusy(false);
    } }
    return <form className="v3-editor" onSubmit={event => { event.preventDefault(); if (!body.trim() && !images.length)
        return; onSend(body, images); if (!retainAfterSend) { setBody(''); setImages([]); } }}>
    <div className="v3-editor-tools"><strong>{label}</strong><span className="v3-spacer"/><button type="button" onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'previewMd')}</button>{onCancel && <button type="button" aria-label={t('cancel')} onClick={onCancel}>×</button>}</div>
    {preview ? <div className="v3-editor-preview"><Markdown body={body}/></div> : <textarea name="body" aria-label={t('body')} rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="**Markdown** · # / - / > / `code` / [link](https://…)"/>}
    {images.length > 0 && <div className="v3-image-strip">{images.map((image, index) => <div key={index}><img src={image} alt={t('imageAlt')}/><button type="button" aria-label={`${t('removeImage')} ${index + 1}`} onClick={() => setImages(images.filter((_, i) => i !== index))}>×</button></div>)}</div>}
    {error && <p role="alert" className="v3-error">{error}</p>}
    <div className="v3-editor-bottom">{pictures && <label className="v3-upload">{t('images')} · {images.length}/9<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy || images.length >= 9} onChange={e => void select(e)}/></label>}<span className="v3-spacer"/><button className="button" type="submit" disabled={busy || (!body.trim() && !images.length)}>{t('send')}</button></div>
  </form>;
}
