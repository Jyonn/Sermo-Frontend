import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n, type TranslationKey } from '../lib/language';
import { showToast } from '../lib/toast';
import { chronelleOrigin } from '../lib/chronelleOrigin';
import chronelleIcon from '../assets/chronelle-icon.png';
import { ConfirmDialog } from './ConfirmDialog';
import './ChronellePluginDialog.css';

export function ChronelleAccountSummary({userId,refresh}:{userId:number;refresh:boolean}) {
  const {t}=useI18n(),[active,setActive]=useState(false);
  useEffect(()=>{let live=true;api.chronelleAccount().then(value=>{if(live)setActive(value.status==='active');}).catch(()=>{if(live)setActive(false);});return()=>{live=false;};},[userId,refresh]);
  return <>{t(active?'chronelle.bound':'chronelle.bind')}</>;
}

export function ChronellePluginDialog({open,onClose,userId,onChange,rebind=false}:{open:boolean;onClose:()=>void;userId:number;onChange:()=>void;rebind?:boolean}) {
  const {t}=useI18n();
  const tr=(key:string)=>t(('research.calendarUI.'+key) as TranslationKey);
  const storageKey=`chronelle:full-pending:${userId}`;
  const [pending,setPending]=useState(()=>Number(sessionStorage.getItem(storageKey))>Date.now());
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
      if(Number(sessionStorage.getItem(storageKey))<=Date.now()){sessionStorage.removeItem(storageKey);setPending(false);setError(errorText('expired'));return;}
      polling=true;
      try{
        const result=await api.chronelleAccount();
        if(stopped||result.status==='binding_required'||result.status==='pending')return;
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
      if(target.origin!==chronelleOrigin()||target.pathname!=='/oauth/authorize/'||target.hash||target.username||target.password||target.searchParams.get('authorization_type')!=='account_binding')throw Error('invalid_response');
      sessionStorage.setItem(storageKey,String(Date.now()+600000));setPending(true);
      if(popup)popup.location.replace(target.href);else window.location.assign(target.href);
    }catch(e){popup?.close();setError(errorText(e instanceof Error?e.message:'binding_required'));}
    finally{setBusy(false);}
  }
  return <><ConfirmDialog open={open&&!unlinkOpen} onClose={onClose} onConfirm={()=>void authorize()} busy={busy} title={rebind?t('chronelle.rebindTitle'):tr('bind')} description={rebind?t('chronelle.rebindHint'):tr('consent')} confirmLabel={tr(pending?'continueBinding':'bind')}>
    <div className="chronelle-binding-consent"><img alt="" src={chronelleIcon}/><div><strong>{tr('visibility')}</strong><span>{tr('policyHint')}</span></div>{pending&&<p role="status">{tr('pending')}</p>}{error&&<p role="alert">{error}</p>}{active&&<button type="button" className="chronelle-binding-unbind" disabled={busy} onClick={()=>setUnlinkOpen(true)}>{tr('unbind')}</button>}</div>
  </ConfirmDialog><ConfirmDialog open={open&&unlinkOpen} onClose={()=>setUnlinkOpen(false)} title={tr('unbind')} description={tr('unbindHint')} danger busy={busy} onConfirm={()=>{setBusy(true);void api.chronelleAccount('revoke',true).then(()=>{setActive(false);setUnlinkOpen(false);sessionStorage.removeItem(storageKey);setPending(false);callback.current();onClose();}).catch(e=>{setUnlinkOpen(false);setError(errorText(e.message));}).finally(()=>setBusy(false));}}/></>;
}
