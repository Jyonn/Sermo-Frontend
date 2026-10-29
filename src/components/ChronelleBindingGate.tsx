import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {showToast} from '../lib/toast';
import {ChronellePluginDialog} from './ChronellePluginDialog';

// A callback is one-shot even if React remounts the authenticated shell.
const exchanges=new Map<string,ReturnType<typeof api.chronelleAccount>>();
export function ChronelleBindingGate({userId}:{userId:number}) {
  const {t}=useI18n();
  const [open,setOpen]=useState(false);
  const [callback]=useState(()=>{const url=new URL(location.href);return url.pathname==='/app/research'&&url.searchParams.has('state')&&(url.searchParams.has('code')||url.searchParams.has('error'))?{state:url.searchParams.get('state')||'',code:url.searchParams.get('code')||undefined,error:url.searchParams.get('error')||undefined}:null;});
  useEffect(()=>{
    let live=true;
    if(callback){
      const url=new URL(location.href);for(const key of ['code','state','error','error_description'])url.searchParams.delete(key);
      history.replaceState(history.state,'',url);
      let exchange=exchanges.get(callback.state);
      if(!exchange){exchange=api.chronelleAccount('claim',undefined,callback);exchanges.set(callback.state,exchange);}
      void exchange.then(value=>{if(!live)return;if(value.status==='active'){sessionStorage.removeItem(`chronelle:full-pending:${userId}`);window.dispatchEvent(new Event('chronelle:bound'));showToast(t('chronelle.bound'));}else showToast(t('chronelle.rebindFailed'));}).catch(()=>{if(live)showToast(t('chronelle.rebindFailed'));});
    }else void api.chronelleAccount().then(value=>{if(live&&value.rebind_required&&sessionStorage.getItem(`chronelle:rebind-dismissed:${userId}`)!=='1')setOpen(true);}).catch(()=>{});
    return()=>{live=false;};
  },[userId,callback]);
  return open?<ChronellePluginDialog open rebind userId={userId} onClose={()=>{setOpen(false);sessionStorage.setItem(`chronelle:rebind-dismissed:${userId}`,'1');}} onChange={()=>window.dispatchEvent(new Event('chronelle:bound'))}/>:null;
}
