import { useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { t } from './copy';
import { insertMarkdown } from './markdown-edit';

export function MarkdownInput({ value, onChange, required = false, rows = 6 }: { value?: string; onChange?: (value: string) => void; required?: boolean; rows?: number }) {
  const [local, setLocal] = useState('');
  const [preview, setPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const body = value ?? local;
  function change(next: string) { setLocal(next); onChange?.(next); }
  function insert(before: string, after = '', fallback = t('mdText')) {
    const input = ref.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const next = insertMarkdown(body,start,end,before,after,fallback);
    change(next.body);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(next.start,next.end); });
  }
  const tools = [
    ['format_bold', 'mdBold', '**', '**'], ['format_italic', 'mdItalic', '*', '*'],
    ['link', 'link', '[', '](https://example.com)'], ['format_quote', 'mdQuote', '\n> ', ''],
    ['format_list_bulleted', 'mdList', '\n- ', ''], ['format_list_numbered', 'mdOrdered', '\n1. ', ''],
    ['code', 'mdCode', '`', '`'], ['data_object', 'mdBlock', '\n```\n', '\n```\n'],
    ['table', 'mdTable', `\n| ${t('mdColumn')} | ${t('mdColumn')} |\n| --- | --- |\n| `, ' |  |\n'],
  ] as const;
  return <div className="v3-md-input">
    <div className="v3-md-toolbar" role="toolbar" aria-label={t('mdTools')}>
      <select aria-label={t('mdHeading')} value="" disabled={preview} onChange={e => { if(e.target.value) insert(`\n${e.target.value} `); }}>
        <option value="">H</option>{[1,2,3,4,5,6].map(n => <option key={n} value={'#'.repeat(n)}>H{n}</option>)}
      </select>
      {tools.map(([icon,key,before,after]) => <button key={key} type="button" title={t(key)} aria-label={t(key)} disabled={preview} onMouseDown={e => e.preventDefault()} onClick={() => insert(before,after)}><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></button>)}
      <button className="v3-md-preview-toggle" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'previewMd')}</button>
    </div>
    <textarea ref={ref} name="body" aria-label={t('body')} rows={rows} required={required} value={body} onChange={e => change(e.target.value)} onInvalid={e => { if(preview) { e.preventDefault(); setPreview(false); requestAnimationFrame(() => { ref.current?.focus(); ref.current?.reportValidity(); }); } }} hidden={preview} placeholder={t('mdPlaceholder')}/>
    {preview && <div className="v3-editor-preview"><Markdown body={body || t('empty')}/></div>}
  </div>;
}
