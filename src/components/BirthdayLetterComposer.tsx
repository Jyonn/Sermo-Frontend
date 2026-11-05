import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import type {BirthdayLetterDraft} from '../lib/birthdayTypes';
import {useI18n,getActiveLocale} from '../lib/language';
import {SideDrawer} from './SideDrawer';
import {FeedbackState} from './FeedbackState';
import {showToast} from '../lib/toast';
import './Birthday.css';

export function BirthdayLetterComposer({userId,platform=false}:{userId:number;platform?:boolean}){
  const {t}=useI18n();const [open,setOpen]=useState(false);const [data,setData]=useState<BirthdayLetterDraft|null>(null);
  const [title,setTitle]=useState('');const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!open)return;const controller=new AbortController();setData(null);setError('');setTitle('');setBody('');
    void api.getBirthdayLetterDraft(userId,platform,controller.signal).then(value=>{if(controller.signal.aborted)return;setData(value);setTitle(value.letter?.title??t('birthday.defaultLetterTitle'));setBody(value.letter?.body??'');}).catch(()=>{if(!controller.signal.aborted)setError(t('birthday.loadFailed'));});
    return()=>controller.abort();
  },[open,userId,platform,retry,t]);
  const save=async()=>{
    if(!data?.birthday_year||busy)return;setBusy(true);setError('');
    try{const value=await api.saveBirthdayLetterDraft(userId,platform,{birthday_year:data.birthday_year,title:title.trim(),body:body.trim()});setData(value);showToast(t('birthday.letterSaved'));setOpen(false);}
    catch{setError(t('birthday.letterSaveFailed'));}finally{setBusy(false);}
  };
  return <><button className="ghost-button birthday-admin-entry" type="button" onClick={()=>setOpen(true)}><span className="material-symbols-outlined" aria-hidden="true">mail</span>{t('birthday.writeLetter')}</button><SideDrawer open={open} onClose={()=>{if(!busy)setOpen(false);}} title={t('birthday.writeLetter')} historyKey={`birthday-letter-${platform?'platform':'space'}-${userId}`}><div className="birthday-letter-editor">
    {!data?<FeedbackState tone={error?'error':'loading'} title={error||t('common.loading')} action={error?<button className="ghost-button" onClick={()=>setRetry(value=>value+1)}>{t('common.retry')}</button>:undefined}/>:!data.birthday_year?<FeedbackState tone="empty" icon="cake" title={t('birthday.memberUnset')}/>:<>
      <p className="detail-text">{t('birthday.letterDelivery',{date:new Date(`${data.occasion}T12:00:00+08:00`).toLocaleDateString(getActiveLocale(),{timeZone:'Asia/Shanghai'})})}</p>
      <label>{t('birthday.letterTitle')}<input className="input" maxLength={80} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>
      <label>{t('birthday.letterBody')}<textarea className="input" rows={10} maxLength={3000} value={body} disabled={busy} onChange={event=>setBody(event.target.value)}/></label>
      <p className="detail-text">{t(platform?'birthday.platformSignature':'birthday.spaceSignature')}</p>
      {data.letter?.opened_at?<p className="detail-text">{t('birthday.editReadLetter')}</p>:null}
      {error?<p className="error-text" role="alert">{error}</p>:null}
      <button className="button birthday-save" disabled={busy||!title.trim()||!body.trim()} onClick={()=>void save()}>{busy?t('common.processing'):t('common.save')}</button>
    </>}
  </div></SideDrawer></>;
}
