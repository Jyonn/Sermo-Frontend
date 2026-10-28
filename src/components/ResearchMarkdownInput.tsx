import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Markdown } from './ResearchMarkdown';
import { useI18n, type TranslationKey } from '../lib/language';
import { insertMarkdown, markdownTable } from '../lib/researchMarkdownEdit';
import { MarkdownHeadingMenu } from './MarkdownHeadingMenu';
import { TablePicker } from './ResearchTablePicker';
import { useMobileMarkdownEditor } from '../lib/useMobileMarkdownEditor';
import './ResearchMarkdownInput.css';
import './MobileMarkdownEditor.css';

type MobileSession = {onDone:()=>void;onCancel:()=>void;busy?:boolean;error?:string;doneLabel?:string;onSkip?:()=>void;skipLabel?:string};

export function MarkdownInput({ value, initialValue = '', onChange, required = false, rows = 6, mobileImmersive = true, mobileSession }: { value?: string; initialValue?:string; onChange?: (value: string) => void; required?: boolean; rows?: number; mobileImmersive?: boolean; mobileSession?:MobileSession }) {
  const {t:translate}=useI18n();
  const t=(key:string)=>translate(('research.md.'+key) as TranslationKey);
  const [local, setLocal] = useState(initialValue);
  const [preview, setPreview] = useState(false);
  const [tableOpen,setTableOpen]=useState(false);
  const [headingOpen,setHeadingOpen]=useState(false);
  const headingAnchor=useRef<HTMLButtonElement>(null);
  const tableAnchor=useRef<HTMLButtonElement>(null);
  const selection=useRef({start:0,end:0});
  const ref = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const snapshot=useRef(value??initialValue);
  const immersive = useMobileMarkdownEditor(root, mobileImmersive, Boolean(mobileSession), ()=>cancel());
  useEffect(()=>{if(immersive.mobile&&!immersive.active)setPreview(false);},[immersive.mobile,immersive.active]);
  const body = value ?? local;
  function change(next: string) { setLocal(next); onChange?.(next); }
  function finish(){if(mobileSession?.busy)return;setHeadingOpen(false);setTableOpen(false);if(mobileSession)mobileSession.onDone();else immersive.close();}
  function cancel(){if(mobileSession?.busy)return;setHeadingOpen(false);setTableOpen(false);if(mobileSession)mobileSession.onCancel();else{change(snapshot.current);immersive.close();}}
  function focus(){if(!immersive.active)snapshot.current=body;immersive.focus();}
  function start(){if(!immersive.active)snapshot.current=body;immersive.start();}
  useLayoutEffect(()=>{if(mobileSession&&immersive.mobile)ref.current?.focus({preventScroll:true});},[Boolean(mobileSession),immersive.mobile]);
  const previewButton=<button className="v3-md-preview-toggle" type="button" title={t(preview ? 'edit' : 'previewMd')} aria-label={t(preview ? 'edit' : 'previewMd')} aria-pressed={preview} onMouseDown={event=>event.preventDefault()} onClick={() => {setHeadingOpen(false);setTableOpen(false);setPreview(!preview);if(preview)requestAnimationFrame(()=>ref.current?.focus({preventScroll:true}));}}><span className="material-symbols-outlined" aria-hidden="true">{preview?'edit':'visibility'}</span></button>;
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
  return <div ref={root} className={`v3-md-input${immersive.mobile?' v3-md-mobile':''}${immersive.active?' v3-md-immersive':''}`} role={immersive.active?'dialog':undefined} aria-modal={immersive.active||undefined} aria-label={immersive.active?t('body'):undefined}>
    {immersive.active?<div className="v3-md-mobile-actions"><button type="button" disabled={mobileSession?.busy} onMouseDown={event=>event.preventDefault()} onClick={cancel}>{translate('common.cancel')}</button>{mobileSession?.onSkip&&<button type="button" disabled={mobileSession.busy} onClick={mobileSession.onSkip}>{mobileSession.skipLabel}</button>}<span/>{previewButton}<button type="button" className="v3-md-done" disabled={mobileSession?.busy} onMouseDown={event=>event.preventDefault()} onClick={finish}>{mobileSession?.busy?translate('common.processing'):mobileSession?.doneLabel||translate('common.done')}</button></div>:previewButton}
    <div className="v3-md-toolbar" role="toolbar" aria-label={t('mdTools')}>
      <button type="button" ref={headingAnchor} title={t('mdHeading')} aria-label={t('mdHeading')} aria-haspopup="menu" aria-expanded={headingOpen} disabled={preview} onMouseDown={e=>e.preventDefault()} onClick={()=>{setTableOpen(false);setHeadingOpen(!headingOpen);}}><span className="material-symbols-outlined" aria-hidden="true">format_h1</span></button>
      {headingOpen&&<MarkdownHeadingMenu anchor={headingAnchor} label={t('mdHeading')} onClose={()=>setHeadingOpen(false)} onSelect={level=>{insert(`\n${'#'.repeat(level)} `);setHeadingOpen(false);}}/>}
      {tools.map(([icon,key,before,after]) => <button key={key} type="button" title={t(key)} aria-label={t(key)} disabled={preview} onMouseDown={e => e.preventDefault()} onClick={() => insert(before,after)}><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></button>)}
      <button type="button" ref={tableAnchor} title={t('mdTable')} aria-label={t('mdTable')} aria-expanded={tableOpen} disabled={preview} onMouseDown={e=>e.preventDefault()} onClick={()=>{setHeadingOpen(false);selection.current={start:ref.current?.selectionStart||0,end:ref.current?.selectionEnd||0};setTableOpen(!tableOpen);}}><span className="material-symbols-outlined" aria-hidden="true">table</span></button>
      {tableOpen&&<TablePicker anchor={tableAnchor} onClose={()=>setTableOpen(false)} onSelect={(x,y)=>{const {start,end}=selection.current;const text=markdownTable(x,y,t('mdColumn'));change(body.slice(0,start)+text+body.slice(end));setTableOpen(false);requestAnimationFrame(()=>{ref.current?.focus();ref.current?.setSelectionRange(start+text.length,start+text.length);});}}/>}
    </div>
    {mobileSession?.error&&<p className="v3-md-mobile-error" role="alert">{mobileSession.error}</p>}
    <textarea ref={ref} name="body" aria-label={t('body')} rows={rows} maxLength={20000} required={required} readOnly={mobileSession?.busy} value={body} onFocus={focus} onPointerDown={start} onChange={e => change(e.target.value)} onInvalid={e => { if(preview) { e.preventDefault(); setPreview(false); requestAnimationFrame(() => { ref.current?.focus(); ref.current?.reportValidity(); }); } }} hidden={preview} placeholder={t('mdPlaceholder')}/>
    {preview && <div className="v3-editor-preview"><Markdown body={body || t('empty')}/></div>}
  </div>;
}
