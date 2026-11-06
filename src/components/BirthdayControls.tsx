import {useEffect,useState} from 'react';
import {useBirthday} from '../lib/birthday';
import {useAuth} from '../lib/auth';
import {api,ApiError} from '../lib/api';
import {getActiveLocale,useI18n} from '../lib/language';
import {showToast} from '../lib/toast';
import {ConfirmDialog} from './ConfirmDialog';
import {DurationWheel} from './DurationPickerField';
import {ForwardArrowIcon} from './ForwardArrowIcon';
import {FeedbackState} from './FeedbackState';
import {BirthdayLetterReader} from './BirthdayLetterReader';
import type {BirthdayEnvelope} from '../lib/birthdayTypes';
import './Birthday.css';

export function birthdayLabel(month:number,day:number){return new Intl.DateTimeFormat(getActiveLocale(),{month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2000,month-1,day)));}
export function BirthdayEditor({open,onClose}:{open:boolean;onClose:()=>void}){
  const {t}=useI18n();const birthday=useBirthday();
  const [month,setMonth]=useState('1');const [day,setDay]=useState('1');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [letters,setLetters]=useState<BirthdayEnvelope[]>([]);const [letterId,setLetterId]=useState<number|null>(null);
  useEffect(()=>{if(!open)return;setError('');setMonth(String(birthday.status?.month??new Date().getMonth()+1));setDay(String(birthday.status?.day??new Date().getDate()));},[open,birthday.status?.month,birthday.status?.day]);
  useEffect(()=>{if(open)void birthday.refresh();},[open]);
  useEffect(()=>{
    if(!open){setLetterId(null);return;}const controller=new AbortController();
    void api.getBirthdayLetters(controller.signal).then(value=>{if(!controller.signal.aborted)setLetters(value);}).catch(()=>{});
    return()=>controller.abort();
  },[open]);
  const count=new Date(2000,Number(month),0).getDate();
  const normalizedDay=Math.min(count,Number(day));
  const editable=birthday.status?.can_change===true;
  const save=async()=>{
    if(!editable||busy)return;setBusy(true);setError('');
    try{const value=await api.setBirthday(Number(month),normalizedDay);birthday.update(value);showToast(t('birthday.saved'));onClose();}
    catch(cause){setError(t(cause instanceof ApiError&&cause.status===403?'birthday.locked':'birthday.saveFailed'));void birthday.refresh();}
    finally{setBusy(false);}
  };
  return <ConfirmDialog open={open} onClose={onClose} title={t('birthday.set')} className="birthday-date-dialog" busy={busy} confirmDisabled={!editable||!birthday.status} confirmLabel={t('common.confirm')} onConfirm={()=>void save()}>
    <div className="birthday-editor">
      {!birthday.status?<FeedbackState tone={birthday.loading?'loading':'error'} title={t(birthday.loading?'common.loading':'birthday.loadFailed')} action={!birthday.loading?<button className="ghost-button" onClick={()=>void birthday.refresh()}>{t('common.retry')}</button>:undefined}/>:<>
      <fieldset className="birthday-date-wheels duration-picker-wheels" disabled={!editable||busy}><DurationWheel label={t('birthday.month')} values={Array.from({length:12},(_,i)=>i+1)} value={Number(month)} onChange={value=>{setMonth(String(value));setDay(String(Math.min(Number(day),new Date(2000,value,0).getDate())));}}/><DurationWheel label={t('birthday.day')} values={Array.from({length:count},(_,i)=>i+1)} value={normalizedDay} onChange={value=>setDay(String(value))}/></fieldset>
      {!editable&&birthday.status.available_at?<p className="birthday-lock-note">{t('birthday.nextChange',{date:new Date(birthday.status.available_at*1000).toLocaleString(getActiveLocale(),{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})})}</p>:null}
      {error?<p className="error-text" role="alert">{error}</p>:null}
      {birthday.status.active?<button className="ghost-button birthday-save" onClick={()=>{onClose();birthday.openWelcome();}}>{t('birthday.reopen')}</button>:null}
      </>}
      {letters.length?<section className="birthday-history"><h3>{t('birthday.savedLetters')}</h3>{letters.map(item=><button type="button" key={item.letter_id} onClick={()=>setLetterId(item.letter_id)}><span className="material-symbols-outlined" aria-hidden="true">{item.opened_at?'drafts':'mail'}</span><span><strong>{item.title}</strong><small>{item.sender_name} · {item.occasion}</small></span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}</section>:null}
      <BirthdayLetterReader letterId={letterId} onClose={()=>setLetterId(null)} onOpened={value=>setLetters(current=>current.map(item=>item.letter_id===value.letter_id?value:item))}/>
    </div>
  </ConfirmDialog>;
}

export function BirthdayProfileRow(){
  const {t}=useI18n();const {session}=useAuth();const birthday=useBirthday();const [open,setOpen]=useState(false);
  return <><button className="simple-row menu-link-row" type="button" onClick={()=>setOpen(true)}><div className="row-main menu-key-cell"><strong>{t('birthday.title')}</strong></div><div className="menu-detail-value menu-detail-text">{birthday.status?.month&&birthday.status.day?birthdayLabel(birthday.status.month,birthday.status.day):t('birthday.unset')}</div><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button><BirthdayEditor key={session?.user.user_id??0} open={open} onClose={()=>setOpen(false)}/></>;
}

export function BirthdayReminder(){
  const {t}=useI18n();const {session}=useAuth();const birthday=useBirthday();const [open,setOpen]=useState(false);
  const userId=session?.user.user_id;
  if(!userId||!birthday.status||birthday.status.month&&!birthday.status.active||birthday.reminderDismissed)return null;
  const active=birthday.status.active;
  return <><button className="verification-banner" type="button" onClick={()=>active?birthday.openWelcome():setOpen(true)}><div className={`verification-banner-copy${active?' birthday-banner-sentence':''}`}><strong>{t(active?'birthday.openWishes':'birthday.title')}</strong>{!active?<span>{t('birthday.reminderHint')}</span>:null}</div><ForwardArrowIcon className="verification-banner-action"/></button><BirthdayEditor key={userId} open={open} onClose={()=>setOpen(false)}/></>;
}
