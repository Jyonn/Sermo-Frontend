import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../lib/bodyLock';
import { useModalFocus } from '../lib/modalFocus';
import { useI18n } from '../lib/language';
import { MarkdownInput } from './ResearchMarkdownInput';
import { useMobileMarkdownMode } from '../lib/useMobileMarkdownEditor';
import './MarkdownEditorDialog.css';

export function MarkdownEditorDialog({title,initialValue='',summary,busy=false,error,confirmLabel,skipLabel,onClose,onSave,onSkip,onChange}:{
  title:string;initialValue?:string;summary?:string;busy?:boolean;error?:string;confirmLabel?:string;skipLabel?:string;
  onClose:()=>void;onSave:(value:string)=>void;onSkip?:()=>void;
  onChange?:(value:string)=>void;
}) {
  const {t}=useI18n();
  const root=useRef<HTMLFormElement>(null),titleId=useId();
  const [body,setBody]=useState(initialValue);
  const mobile=useMobileMarkdownMode();
  useBodyScrollLock(true);
  useModalFocus(root,!mobile,()=>{if(!busy)onClose();});
  if(mobile)return createPortal(<MarkdownInput value={body} onChange={value=>{setBody(value);onChange?.(value);}} mobileSession={{onDone:()=>{if(!busy)onSave(body);},onCancel:onClose,busy,error,doneLabel:confirmLabel,onSkip,skipLabel}}/>,document.body);
  return createPortal(<div className="dialog-backdrop markdown-editor-backdrop" role="presentation" onClick={()=>{if(!busy)onClose();}}>
    <form ref={root} tabIndex={-1} className="markdown-editor-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();if(!busy)onSave(body);}}>
      <header><div><h2 id={titleId}>{title}</h2>{summary&&<p>{summary}</p>}</div><button className="ghost-button" type="button" aria-label={t('common.close')} disabled={busy} onClick={onClose}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
      <div className="markdown-editor-dialog-body"><MarkdownInput value={body} onChange={value=>{setBody(value);onChange?.(value);}} rows={10}/></div>
      {error&&<p className="markdown-editor-dialog-error" role="alert">{error}</p>}
      <footer>{onSkip&&<button className="ghost-button" type="button" disabled={busy} onClick={onSkip}>{skipLabel}</button>}<button className="button" type="submit" disabled={busy}>{busy?t('common.processing'):confirmLabel||t('research.save')}</button></footer>
    </form>
  </div>,document.body);
}
