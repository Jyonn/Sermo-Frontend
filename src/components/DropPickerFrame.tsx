import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api,ApiError} from '../lib/api';
import {DROP_API_ORIGIN,dropShareUrl,readDropPickerMessage} from '../lib/dropPicker';
import {useI18n} from '../lib/language';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useModalFocus} from '../lib/modalFocus';
import {FeedbackState} from './FeedbackState';
import './PockloDrawer.css';

export function DropPickerFrame({clientId,onClose,onShare,onConnectionError}:{clientId:string;onClose:()=>void;onShare:(url:string)=>Promise<boolean|void>;onConnectionError:()=>void}){
  const {t}=useI18n(),frame=useRef<HTMLIFrameElement>(null),root=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState('loading'),[sendState,setSendState]=useState<'idle'|'sending'|'failed'>('idle'),[creating,setCreating]=useState(false);
  const live=useRef(true);
  const busy=useRef(false),selectedUrl=useRef<string|null>(null),callbacks=useRef({onClose,onShare,onConnectionError});callbacks.current={onClose,onShare,onConnectionError};
  const close=()=>{if(!busy.current)callbacks.current.onClose()};
  async function send(){const url=selectedUrl.current;if(!url||busy.current)return;busy.current=true;setSendState('sending');try{if(await callbacks.current.onShare(url)===false)throw Error();if(live.current)callbacks.current.onClose()}catch{if(live.current)setSendState('failed')}finally{busy.current=false}}
  useBodyScrollLock(true);useModalFocus(root,true,close);
  useLayoutEffect(()=>{
    live.current=true;
    const element=frame.current,target=element?.contentWindow;if(!element||!target)return;
    const lifetime=new AbortController(),pending=new Map<string,AbortController>(),created=new Set<string>();let ready=false;
    const post=(type:string,data:object)=>{if(!lifetime.signal.aborted)target.postMessage({type:'drop.picker.'+type,version:1,...data},DROP_API_ORIGIN)};
    const timer=setTimeout(()=>setStatus('unavailable'),12000);
    async function receive(event:MessageEvent){
      const m=readDropPickerMessage(event,target??null);if(!m||lifetime.signal.aborted)return;
      if(m.type==='ready'){if(busy.current)return;ready=true;created.clear();clearTimeout(timer);post('init',{canShare:true});setStatus('ready');return}
      if(!ready)return;
      if(m.type==='cancelled'){close();return}
      if(m.type==='selected'){if(!busy.current&&!selectedUrl.current&&created.has(m.url)){selectedUrl.current=m.url;void send()}return}
      if(pending.has(m.requestId))return;
      if(pending.size>=8||(m.type==='share'&&busy.current)){post('response',{requestId:m.requestId,error:'unavailable'});return}
      const controller=new AbortController();pending.set(m.requestId,controller);
      if(m.type==='share'){busy.current=true;setCreating(true)}
      const timeout=setTimeout(()=>controller.abort(),m.type==='share'?20000:12000);
      try{
        if(m.type==='entries'){const result=await api.dropEntries(m.query,m.offset,controller.signal);post('response',{requestId:m.requestId,result})}
        else{const result=await api.dropShare(m.entryIds,m.fields,m.expiresIn,m.operationId,controller.signal);const url=dropShareUrl(result.url);if(!url)throw Error();created.add(url);post('response',{requestId:m.requestId,result:{...result,url}})}
      }catch(cause){if(lifetime.signal.aborted)return;const code=cause instanceof ApiError?cause.identifier:'unavailable';post('response',{requestId:m.requestId,error:code});if(code==='connect_required')callbacks.current.onConnectionError()}
      finally{clearTimeout(timeout);pending.delete(m.requestId);if(m.type==='share'){busy.current=false;if(!lifetime.signal.aborted)setCreating(false)}}
    }
    window.addEventListener('message',receive);
    const url=new URL('/picker/embed/',DROP_API_ORIGIN);url.searchParams.set('mode','oauth');url.searchParams.set('client_id',clientId);url.searchParams.set('origin',location.origin);element.src=url.href;
    return()=>{live.current=false;lifetime.abort();pending.forEach(c=>c.abort());clearTimeout(timer);window.removeEventListener('message',receive)};
  },[clientId]);
  return createPortal(<div className="dialog-backdrop pocklo-picker-overlay" ref={root} role="dialog" aria-modal="true" aria-label={t('drop.choose')} tabIndex={-1} onClick={e=>{if(e.target===e.currentTarget)close()}}>
    {status!=='ready'?<div className="pocklo-picker-status"><FeedbackState tone={status==='loading'?'loading':'error'} title={t(status==='loading'?'common.loading':'drop.unavailable')} action={status==='loading'?undefined:<button type="button" className="secondary-button" onClick={close}>{t('common.close')}</button>}/></div>:null}
    <iframe ref={frame} title={t('drop.choose')} hidden={status!=='ready'||sendState!=='idle'} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/>
    {creating?<span className="visually-hidden" role="status">{t('common.loading')}</span>:null}
    {sendState!=='idle'?<div className="pocklo-picker-status"><FeedbackState tone={sendState==='sending'?'loading':'error'} title={t(sendState==='sending'?'common.loading':'drop.sendFailed')} action={sendState==='failed'?<div className="button-row"><button type="button" className="button" onClick={()=>void send()}>{t('common.retry')}</button><button type="button" className="ghost-button" onClick={close}>{t('common.close')}</button></div>:undefined}/></div>:null}
  </div>,document.body);
}
