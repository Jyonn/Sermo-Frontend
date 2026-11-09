import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n, type TranslationKey } from '../lib/language';
import { chronelleOrigin } from '../lib/chronelleOrigin';
import { rememberChronelleReturn } from '../lib/chronelleReturn';
import { getDetectedSpaceSlug } from '../lib/spaceEntry';
import chronelleIcon from '../assets/chronelle-icon.png';
import { ConfirmDialog } from './ConfirmDialog';
import './ChronellePluginDialog.css';
import {ChronellePermissionsDrawer} from './ChronellePermissionsDrawer';

export function ChronelleAccountSummary({userId,refresh}:{userId:number;refresh:boolean}) {
  const {t}=useI18n(),[active,setActive]=useState(false);
  useEffect(()=>{let live=true;api.chronelleAccount().then(value=>{if(live)setActive(value.status==='active');}).catch(()=>{if(live)setActive(false);});return()=>{live=false;};},[userId,refresh]);
  return <>{t(active?'chronelle.bound':'chronelle.bind')}</>;
}

export function ChronellePluginDialog({open,onClose,userId,onChange,rebind=false,context={entry:"menu"}}:{
  open:boolean;onClose:()=>void;userId:number;onChange:()=>void;rebind?:boolean;
  context?: Parameters<typeof api.authorizeChronelle>[0];
}) {
  const {t}=useI18n();
  const tr=(key:string)=>t(('research.calendarUI.'+key) as TranslationKey);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [active,setActive]=useState(false);
  const [checking,setChecking]=useState(true);
  const callback=useRef(onChange);callback.current=onChange;
  const errorText=(code:string)=>{const key=('research.calendarUI.error.'+code) as TranslationKey;const value=t(key);return value===key?tr('unavailable'):value;};
  useEffect(()=>{if(!open){setChecking(true);return;}let live=true;setChecking(true);api.chronelleAccount().then(value=>{if(live)setActive(value.status==='active');}).catch(()=>{}).finally(()=>{if(live)setChecking(false);});return()=>{live=false;};},[open]);
  async function authorize(){
    if(busy)return;
    setBusy(true);setError('');
    try{
      const result=await api.authorizeChronelle(context);
      const target=new URL(result.authorize_url||'');
      if(target.origin!==chronelleOrigin()||target.pathname!=='/oauth/authorize/'||target.hash||target.username||target.password||target.searchParams.get('authorization_type')!=='account_binding')throw Error('invalid_response');
      rememberChronelleReturn(target.searchParams.get('state')||'',getDetectedSpaceSlug(),userId,localStorage);
      window.location.assign(target.href);
    }catch(e){setError(errorText(e instanceof Error?e.message:'binding_required'));setBusy(false);}
  }
  return <><ChronellePermissionsDrawer open={open&&active&&!checking} onClose={onClose} onChange={()=>{callback.current();window.dispatchEvent(new Event('chronelle:bound'));}} onRebind={()=>setActive(false)}/><ConfirmDialog open={open&&!active&&!checking} onClose={onClose} onConfirm={()=>void authorize()} busy={busy} title={rebind?t('chronelle.rebindTitle'):tr('bind')} description={t('chronelle.bindingConsentShort')} confirmLabel={tr('bind')}>
    <div className="chronelle-binding-consent"><img alt="" src={chronelleIcon}/><div><strong>{tr('visibility')}</strong><span>{t('chronelle.defaultVisibilityShort')}</span></div>{error&&<p role="alert">{error}</p>}</div>
  </ConfirmDialog></>;
}
