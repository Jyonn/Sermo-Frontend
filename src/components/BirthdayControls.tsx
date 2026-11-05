import {useEffect,useState} from 'react';
import {useBirthday} from '../lib/birthday';
import {useAuth} from '../lib/auth';
import {api,ApiError} from '../lib/api';
import {getActiveLocale,useI18n} from '../lib/language';
import {showToast} from '../lib/toast';
import {SideDrawer} from './SideDrawer';
import {SelectControl,SettingGroup,SettingRow} from './SettingRow';
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
  return <SideDrawer open={open} onClose={()=>{if(!busy)onClose();}} title={t('birthday.title')} historyKey="birthday-settings">
    <div className="birthday-editor"><p className="detail-text">{t('birthday.policy')}</p>
      {!birthday.status?<FeedbackState tone={birthday.loading?'loading':'error'} title={t(birthday.loading?'common.loading':'birthday.loadFailed')} action={!birthday.loading?<button className="ghost-button" onClick={()=>void birthday.refresh()}>{t('common.retry')}</button>:undefined}/>:<>
      <div className="birthday-date-fields"><label><span>{t('birthday.month')}</span><SelectControl label={t('birthday.month')} value={month} disabled={!editable||busy} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:new Intl.DateTimeFormat(getActiveLocale(),{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1)))}))} onChange={setMonth}/></label><label><span>{t('birthday.day')}</span><SelectControl label={t('birthday.day')} value={String(normalizedDay)} disabled={!editable||busy} options={Array.from({length:count},(_,i)=>({value:String(i+1),label:String(i+1)}))} onChange={setDay}/></label></div>
      <p className="detail-text birthday-policy-note">{t('birthday.leapPolicy')}</p>
      {!editable&&birthday.status.available_at?<p className="birthday-lock-note">{t('birthday.nextChange',{date:new Date(birthday.status.available_at*1000).toLocaleString(getActiveLocale(),{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})})}</p>:null}
      {error?<p className="error-text" role="alert">{error}</p>:null}
      {editable?<button className="button birthday-save" disabled={busy} onClick={()=>void save()}>{busy?t('common.processing'):t('birthday.confirmDate',{date:birthdayLabel(Number(month),normalizedDay)})}</button>:null}
      {birthday.status.active?<button className="ghost-button birthday-save" onClick={()=>{onClose();birthday.openWelcome();}}>{t('birthday.reopen')}</button>:null}
      </>}
      {letters.length?<section className="birthday-history"><h3>{t('birthday.savedLetters')}</h3>{letters.map(item=><button type="button" key={item.letter_id} onClick={()=>setLetterId(item.letter_id)}><span className="material-symbols-outlined" aria-hidden="true">{item.opened_at?'drafts':'mail'}</span><span><strong>{item.title}</strong><small>{item.sender_name} · {item.occasion}</small></span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}</section>:null}
      <BirthdayLetterReader letterId={letterId} onClose={()=>setLetterId(null)} onOpened={value=>setLetters(current=>current.map(item=>item.letter_id===value.letter_id?value:item))}/>
    </div>
  </SideDrawer>;
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
  const unread=birthday.status.letters.filter(letter=>!letter.opened_at).length;
  return <><aside className="birthday-reminder"><span className="material-symbols-outlined" aria-hidden="true">cake</span><button type="button" onClick={()=>active?birthday.openWelcome():setOpen(true)}><strong>{t(active?'birthday.happyToday':'birthday.reminder')}</strong><small>{active?(unread?t('birthday.unreadLetters',{count:unread}):t('birthday.reopen')):t('birthday.reminderHint')}</small></button><button className="birthday-reminder-close" aria-label={t('common.close')} onClick={birthday.dismissReminder}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></aside><BirthdayEditor key={userId} open={open} onClose={()=>setOpen(false)}/></>;
}
