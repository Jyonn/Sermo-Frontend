import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import {SquareVoicePreview} from './SquareVoicePreview';
import './SquareComposerEditor.css';
import type {LinkPreviewDTO} from '../types';
import {LinkPreviewCard} from './LinkPreviewCard';
import {DrawerDismissButton} from './OverlayIconButton';
interface Props{
  text:string;onText:(text:string)=>void;limit:number;photos:Array<{id:string;preview:string}>;video:{preview:string;duration:number}|null;voice:{uri:string;duration:number}|null;external:LinkPreviewDTO|null;
  onRemovePhoto:(id:string)=>void;onRemoveVideo:()=>void;onRemoveVoice:()=>void;onRemoveExternal:()=>void;onAdd:()=>void;onBack:()=>void;onPublish:()=>void;
  audienceLabel:string;onAudience?:()=>void;locationLabel:string;onLocation:()=>void;onRemoveLocation?:()=>void;publishing:boolean;publishable:boolean;progress:number;error?:string;chatPreview?:ReactNode;extraSettings?:ReactNode;quotaLabel?:string;
  editing?:boolean;conflictAction?:ReactNode;
}
export function SquareComposerEditor(p:Props){
  const {t}=useI18n(),writing=useRef<HTMLTextAreaElement>(null);
  const count=Array.from(p.text).length;
  useLayoutEffect(()=>{const node=writing.current;if(node){node.style.height='auto';node.style.height=`${Math.max(200,node.scrollHeight)}px`}},[p.text]);
  const remove=(onClick:()=>void)=><button className="square-editor-remove" disabled={p.publishing} aria-label={t('common.remove')} onClick={onClick} type="button"><span className="material-symbols-outlined">close</span></button>;
  return <section className="square-editor">
    <header className="square-editor-header"><DrawerDismissButton className="square-editor-dismiss" disabled={p.publishing} onClick={p.onBack} /><span>{t(p.editing?'square.editStatement':'square.composeTitle')}</span><small>{count}/{p.limit}</small></header>
    <main className="square-editor-body">
      {p.error?<div className="square-inline-error" role="alert">{p.error}</div>:null}
      {p.conflictAction}
      <div className="square-editor-media">
        {p.photos.map(photo=><div className="square-editor-thumb" key={photo.id}><img src={photo.preview} alt={t('square.photo')}/>{remove(()=>p.onRemovePhoto(photo.id))}</div>)}
        {p.video?<div className="square-editor-thumb"><video src={p.video.preview} muted playsInline preload="metadata"/><span className="square-editor-duration">{p.video.duration}s</span>{remove(p.onRemoveVideo)}</div>:null}
        {p.voice?<SquareVoicePreview key={p.voice.uri} uri={p.voice.uri} duration={p.voice.duration} onRemove={p.onRemoveVoice} disabled={p.publishing}/>:null}
        {!p.chatPreview&&p.photos.length<9?<button className="square-editor-add" disabled={p.publishing} aria-label={t('square.addMedia')} onClick={p.onAdd} type="button"><span className="material-symbols-outlined">add</span></button>:null}
      </div>
      <textarea ref={writing} autoFocus={!p.photos.length&&!p.video&&!p.voice&&!p.external} aria-label={t('square.saySomething')} placeholder={t('square.saySomething')} value={p.text}
        onChange={event=>p.onText(Array.from(event.target.value).slice(0,Math.max(p.limit,count)).join(''))} disabled={p.publishing}/>
      {p.external?<div className="square-editor-external"><LinkPreviewCard preview={p.external}/>{remove(p.onRemoveExternal)}</div>:null}
      {p.chatPreview}
      <div className="square-editor-settings">
        <div className="square-editor-location"><button disabled={p.publishing} onClick={p.onLocation} type="button"><span className="material-symbols-outlined">location_on</span><span>{p.locationLabel}</span><span className="material-symbols-outlined">chevron_right</span></button>{p.onRemoveLocation?<button aria-label={t('common.remove')} onClick={p.onRemoveLocation} type="button"><span className="material-symbols-outlined">close</span></button>:null}</div>
        <button disabled={p.publishing||!p.onAudience} onClick={p.onAudience} type="button"><span className="material-symbols-outlined">visibility</span><span>{p.audienceLabel}</span>{p.onAudience&&<span className="material-symbols-outlined">chevron_right</span>}</button>
        {p.extraSettings}
      </div>
    </main>
    <footer className="square-editor-footer">{p.quotaLabel?<small>{p.quotaLabel}</small>:null}<button disabled={!p.publishable||p.publishing} onClick={p.onPublish} type="button">{p.publishing?<><span className="media-wait-spinner"/>{t(p.editing?'common.processing':'square.publishing')}{p.progress>0?` ${Math.round(p.progress*100)}%`:''}</>:t(p.editing?'common.save':'square.publishStatement')}</button></footer>
  </section>;
}
