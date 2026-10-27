import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n, type TranslationKey } from '../lib/language';
import { showToast } from '../lib/toast';
import { chronelleOrigin } from '../lib/chronelleOrigin';
import chronelleIcon from '../assets/chronelle-icon.png';
import { ConfirmDialog } from './ConfirmDialog';

export function ChronelleAccountSummary({userId,refresh}:{userId:number;refresh:boolean}) {
  const {t}=useI18n(),[active,setActive]=useState(false);
  useEffect(()=>{let live=true;api.chronelleAccount().then(value=>{if(live)setActive(value.status==='active');}).catch(()=>{if(live)setActive(false);});return()=>{live=false;};},[userId,refresh]);
  return <>{t(active?'chronelle.bound':'chronelle.bind')}</>;
}

export function ChronellePluginDialog({open,onClose,userId,onChange}:{open:boolean;onClose:()=>void;userId:number;onChange:()=>void}) {
  const {t}=useI18n();
  const tr=(key:string)=>t(('research.calendarUI.'+key) as TranslationKey);
  const storageKey=`chronelle:full-pending:${userId}`;
  const [pending,setPending]=useState(()=>sessionStorage.getItem(storageKey)==='1');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [active,setActive]=useState(false),[unlinkOpen,setUnlinkOpen]=useState(false);
  const callback=useRef(onChange);callback.current=onChange;
  const errorText=(code:string)=>{const key=('research.calendarUI.error.'+code) as TranslationKey;const value=t(key);return value===key?tr('unavailable'):value;};
  useEffect(()=>{if(!open)return;let live=true;api.chronelleAccount().then(value=>{if(live)setActive(value.status==='active');}).catch(()=>{});return()=>{live=false;};},[open]);
  useEffect(()=>{
    if(!pending)return;
    let stopped=false,polling=false;
    const timer=window.setInterval(async()=>{
      if(polling||document.visibilityState!=='visible')return;
      polling=true;
      try{
        const result=await api.chronelleAccount('claim');
        if(stopped||result.status==='pending')return;
        sessionStorage.removeItem(storageKey);sessionStorage.removeItem(`chronelle:return-project:${userId}`);setPending(false);
        if(result.status==='active'){callback.current();showToast(t('chronelle.bound'));onClose();}
        else setError(errorText(result.status));
      }catch(e){if(!stopped){sessionStorage.removeItem(storageKey);setPending(false);setError(errorText(e instanceof Error?e.message:'binding_required'));}}
      finally{polling=false;}
    },5000);
    return()=>{stopped=true;window.clearInterval(timer);};
  },[pending,storageKey,userId]);
  async function authorize(){
    if(busy)return;
    setBusy(true);setError('');
    const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    try{
      const result=await api.chronelleAccount('authorize',true);
      const target=new URL(result.authorize_url||'');
      if(target.origin!==chronelleOrigin()||!/^#\/bind-calendar\/[0-9a-f-]{36}$/i.test(target.hash))throw Error('invalid_response');
      sessionStorage.setItem(storageKey,'1');setPending(true);
      if(popup)popup.location.replace(target.href);else window.location.assign(target.href);
    }catch(e){popup?.close();setError(errorText(e instanceof Error?e.message:'binding_required'));}
    finally{setBusy(false);}
  }
  return <><ConfirmDialog open={open&&!unlinkOpen} onClose={onClose} onConfirm={()=>void authorize()} busy={busy} title={tr('bind')} description={tr('consent')} confirmLabel={tr(pending?'continueBinding':'bind')}>
    <div className="more-apps-consent"><img alt="" src={chronelleIcon}/><div><strong>{tr('visibility')}</strong><span>{tr('policyHint')}</span></div>{pending&&<p role="status">{tr('pending')}</p>}{error&&<p role="alert">{error}</p>}{active&&<button type="button" className="chronelle-unbind" disabled={busy} onClick={()=>setUnlinkOpen(true)}>{tr('unbind')}</button>}</div>
  </ConfirmDialog><ConfirmDialog open={open&&unlinkOpen} onClose={()=>setUnlinkOpen(false)} title={tr('unbind')} description={tr('unbindHint')} danger busy={busy} onConfirm={()=>{setBusy(true);void api.chronelleAccount('revoke',true).then(()=>{setActive(false);setUnlinkOpen(false);sessionStorage.removeItem(storageKey);setPending(false);callback.current();onClose();}).catch(e=>{setUnlinkOpen(false);setError(errorText(e.message));}).finally(()=>setBusy(false));}}/></>;
}
