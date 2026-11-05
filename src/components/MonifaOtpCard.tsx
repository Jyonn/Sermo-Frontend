import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {copyText} from '../lib/presentation';
import type {MonifaOtp} from '../lib/monifa';
import './MonifaOtpCard.css';

export function MonifaOtpCard({url}:{url:string}){
  const {t}=useI18n();
  const [data,setData]=useState<MonifaOtp|null>(null),[busy,setBusy]=useState(false),[remaining,setRemaining]=useState(0),[copied,setCopied]=useState(false);
  const request=useRef<AbortController|null>(null),expiry=useRef(0),copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  async function load(){
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setCopied(false);const started=Date.now(),timeout=setTimeout(()=>controller.abort('timeout'),12000);
    try{const result=await api.getMonifaOtp(url,controller.signal);if(controller.signal.aborted)return;setData(result);expiry.current=started+Math.max(0,(result.remaining??0)-1)*1000;setRemaining(Math.max(0,Math.ceil((expiry.current-Date.now())/1000)))}
    catch{if(!controller.signal.aborted||controller.signal.reason==='timeout'){setData({status:'error'});setRemaining(0)}}
    finally{clearTimeout(timeout);if(!controller.signal.aborted||controller.signal.reason==='timeout')setBusy(false)}
  }
  useEffect(()=>{setData(null);void load();const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((expiry.current-Date.now())/1000))),1000);return()=>{request.current?.abort();clearInterval(timer);if(copyTimer.current)clearTimeout(copyTimer.current)}},[url]);
  const valid=data?.status==='ready'&&remaining>0&&!busy&&Date.now()<expiry.current;
  return <section className="monifa-otp-card" aria-label={t('monifa.card')} onClick={event=>event.stopPropagation()}>
    <header><span className="monifa-otp-brand"><span className="material-symbols-outlined" aria-hidden="true">encrypted</span>MONIFA <small>OTP</small></span><a href={url} rel="noreferrer" target="_blank" aria-label={t('monifa.open')}><span className="material-symbols-outlined" aria-hidden="true">north_east</span></a></header>
    <div className="monifa-otp-identity"><strong>{data?.issuer||t('monifa.shared')}</strong>{data?.accountName?<small>{data.accountName}</small>:null}</div>
    <button className="monifa-otp-code" type="button" disabled={!valid} aria-label={t(copied?'monifa.copied':'monifa.copy')} onClick={()=>{if(valid&&data?.code&&Date.now()<expiry.current)void copyText(data.code).then(success=>{if(!success)return;setCopied(true);if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),1500)})}}><span>{valid?data.code?.replace(/(.{3,4})(?=.{3,4}$)/,'$1 '):'••• •••'}</span><span className="material-symbols-outlined" aria-hidden="true">{copied?'check':'content_copy'}</span></button>
    <div className="monifa-otp-progress" aria-hidden="true"><i style={{width:`${data?.period?remaining/data.period*100:0}%`}}/></div>
    <footer><span role="status">{busy?t('common.loading'):data?.status==='unavailable'?t('monifa.unavailable'):data?.status==='error'?t('monifa.failed'):remaining>0?t('monifa.remaining',{count:remaining}):t('monifa.expired')}</span><button type="button" disabled={busy} onClick={()=>void load()}><span className="material-symbols-outlined" aria-hidden="true">refresh</span>{t('monifa.refresh')}</button></footer>
  </section>
}
