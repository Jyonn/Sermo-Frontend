import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import './SquareComposerEditor.css';
interface Props{
  text:string;onText:(text:string)=>void;limit:number;photos:Array<{id:string;preview:string}>;video:{preview:string;duration:number}|null;voice:{uri:string;duration:number}|null;external:{title?:string;image_url?:string|null}|null;
  onRemovePhoto:(id:string)=>void;onRemoveVideo:()=>void;onRemoveVoice:()=>void;onRemoveExternal:()=>void;onAdd:()=>void;onBack:()=>void;onPublish:()=>void;
  audienceLabel:string;onAudience:()=>void;locationLabel:string;onLocation:()=>void;onRemoveLocation?:()=>void;publishing:boolean;publishable:boolean;progress:number;error?:string;chatPreview?:ReactNode;extraSettings?:ReactNode;quotaLabel?:string;
}
export function SquareComposerEditor(p:Props){
  const {t}=useI18n(),writing=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{const node=writing.current;if(node){node.style.height='auto';node.style.height=`${Math.max(200,node.scrollHeight)}px`}},[p.text]);
  const remove=(onClick:()=>void)=><button className="square-editor-remove" disabled={p.publishing} aria-label={t('common.remove')} onClick={onClick} type="button"><span className="material-symbols-outlined">close</span></button>;
  return <section className="square-editor">
    <header className="square-editor-header"><button aria-label={t('common.back')} disabled={p.publishing} onClick={p.onBack} type="button"><span className="material-symbols-outlined">arrow_back</span></button><span>{t('square.composeTitle')}</span><small>{p.text.length}/{p.limit}</small></header>
    <main className="square-editor-body">
      {p.error?<div className="square-inline-error" role="alert">{p.error}</div>:null}
      <div className="square-editor-media">
        {p.photos.map(photo=><div className="square-editor-thumb" key={photo.id}><img src={photo.preview} alt={t('square.photo')}/>{remove(()=>p.onRemovePhoto(photo.id))}</div>)}
        {p.video?<div className="square-editor-thumb"><video src={p.video.preview} muted playsInline preload="metadata"/><span className="square-editor-duration">{p.video.duration}s</span>{remove(p.onRemoveVideo)}</div>:null}
        {p.voice?<div className="square-editor-thumb is-audio"><span className="material-symbols-outlined">graphic_eq</span><small>{p.voice.duration}s</small>{remove(p.onRemoveVoice)}</div>:null}
        {p.external?<div className="square-editor-thumb is-link">{p.external.image_url?<img src={p.external.image_url} alt=""/>:<span className="material-symbols-outlined">link</span>}<small>{p.external.title||t('square.externalMedia')}</small>{remove(p.onRemoveExternal)}</div>:null}
        {!p.chatPreview&&p.photos.length<9?<button className="square-editor-add" disabled={p.publishing} aria-label={t('square.addMedia')} onClick={p.onAdd} type="button"><span className="material-symbols-outlined">add</span></button>:null}
      </div>
      {p.voice?<audio className="square-editor-audio" src={p.voice.uri} controls preload="metadata"/>:null}
      <textarea ref={writing} autoFocus={!p.photos.length&&!p.video&&!p.voice&&!p.external} aria-label={t('square.saySomething')} placeholder={t('square.saySomething')} value={p.text} maxLength={p.limit} onChange={event=>p.onText(event.target.value)} disabled={p.publishing}/>
      {p.chatPreview}
      <div className="square-editor-settings">
        <div className="square-editor-location"><button disabled={p.publishing} onClick={p.onLocation} type="button"><span className="material-symbols-outlined">location_on</span><span>{p.locationLabel}</span><span className="material-symbols-outlined">chevron_right</span></button>{p.onRemoveLocation?<button aria-label={t('common.remove')} onClick={p.onRemoveLocation} type="button"><span className="material-symbols-outlined">close</span></button>:null}</div>
        <button disabled={p.publishing} onClick={p.onAudience} type="button"><span className="material-symbols-outlined">visibility</span><span>{p.audienceLabel}</span><span className="material-symbols-outlined">chevron_right</span></button>
        {p.extraSettings}
      </div>
    </main>
    <footer className="square-editor-footer">{p.quotaLabel?<small>{p.quotaLabel}</small>:null}<button disabled={!p.publishable||p.publishing} onClick={p.onPublish} type="button">{p.publishing?<><span className="media-wait-spinner"/>{t('square.publishing')} {Math.round(p.progress*100)}%</>:t('square.publishStatement')}</button></footer>
  </section>;
}
