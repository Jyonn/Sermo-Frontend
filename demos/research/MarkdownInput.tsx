import { useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { t } from './copy';
import { insertMarkdown, markdownTable } from './markdown-edit';
import { SelectControl } from '../../src/components/SettingRow';
import { TablePicker } from './TablePicker';

export function MarkdownInput({ value, onChange, required = false, rows = 6 }: { value?: string; onChange?: (value: string) => void; required?: boolean; rows?: number }) {
  const [local, setLocal] = useState('');
  const [preview, setPreview] = useState(false);
  const [tableOpen,setTableOpen]=useState(false);
  const tableAnchor=useRef<HTMLButtonElement>(null);
  const selection=useRef({start:0,end:0});
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
  ] as const;
  return <div className="v3-md-input">
    <div className="v3-md-toolbar" role="toolbar" aria-label={t('mdTools')}>
      <SelectControl label={t('mdHeading')} value="" disabled={preview} options={[{value:'',label:'H'},...[1,2,3,4,5,6].map(n=>({value:'#'.repeat(n),label:`H${n}`}))]} onChange={value=>{if(value)insert(`\n${value} `);}}/>
      {tools.map(([icon,key,before,after]) => <button key={key} type="button" title={t(key)} aria-label={t(key)} disabled={preview} onMouseDown={e => e.preventDefault()} onClick={() => insert(before,after)}><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></button>)}
      <button type="button" ref={tableAnchor} aria-label={t('mdTable')} aria-expanded={tableOpen} disabled={preview} onMouseDown={e=>e.preventDefault()} onClick={()=>{selection.current={start:ref.current?.selectionStart||0,end:ref.current?.selectionEnd||0};setTableOpen(!tableOpen);}}><span className="material-symbols-outlined" aria-hidden="true">table</span></button>
      {tableOpen&&<TablePicker anchor={tableAnchor} onClose={()=>setTableOpen(false)} onSelect={(x,y)=>{const {start,end}=selection.current;const text=markdownTable(x,y,t('mdColumn'));change(body.slice(0,start)+text+body.slice(end));setTableOpen(false);requestAnimationFrame(()=>{ref.current?.focus();ref.current?.setSelectionRange(start+text.length,start+text.length);});}}/>}
      <button className="v3-md-preview-toggle" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'previewMd')}</button>
    </div>
    <textarea ref={ref} name="body" aria-label={t('body')} rows={rows} required={required} value={body} onChange={e => change(e.target.value)} onInvalid={e => { if(preview) { e.preventDefault(); setPreview(false); requestAnimationFrame(() => { ref.current?.focus(); ref.current?.reportValidity(); }); } }} hidden={preview} placeholder={t('mdPlaceholder')}/>
    {preview && <div className="v3-editor-preview"><Markdown body={body || t('empty')}/></div>}
  </div>;
}
