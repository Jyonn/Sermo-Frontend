import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {useBirthday} from '../lib/birthday';
import {useAuth} from '../lib/auth';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {birthdayAssets} from '../lib/birthdayAssets';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useModalFocus} from '../lib/modalFocus';
import {OverlayScope} from '../lib/overlayLayer';
import {BirthdayLetterReader} from './BirthdayLetterReader';
import './Birthday.css';

function locallySeen(id:string){try{return sessionStorage.getItem(`frienden:birthday-seen:${id}`)==='1';}catch{return false;}}

function BirthdayRibbons({burst}:{burst:number}){
  const [visible,setVisible]=useState(true);
  useEffect(()=>{setVisible(true);const timer=window.setTimeout(()=>setVisible(false),5500);return()=>window.clearTimeout(timer);},[burst]);
  if(!visible)return null;
  return <div key={burst} className="birthday-ribbons" aria-hidden="true">{Array.from({length:48},(_,i)=><i key={i} style={{'--ribbon-x':`${(i*37+11)%100}%`,'--ribbon-drift':`${(i*29)%180-90}px`,'--ribbon-delay':`${i%12*.07}s`,'--ribbon-duration':`${3+i%7*.23}s`,'--ribbon-spin':`${i%2?-1:1}turn`,'--ribbon-color':['#c4a567','#8fa57c','#e1a89a','#e8d4a4','#b9c6a0','#c99967'][i%6]} as CSSProperties}/> )}</div>;
}

export function BirthdayExperience(){
  const birthday=useBirthday();const {session}=useAuth();const {t}=useI18n();
  const root=useRef<HTMLElement|null>(null);const attempted=useRef<string|null>(null);
  const [letter,setLetter]=useState<number|null>(null);const opening=letter;
  const [wished,setWished]=useState(false);
  const [burst,setBurst]=useState(0);
  const close=()=>{setLetter(null);birthday.closeWelcome();};
  useBodyScrollLock(birthday.welcomeOpen);
  useModalFocus(root,birthday.welcomeOpen,close);
  useEffect(()=>{
    const value=birthday.status;if(!value?.active||!value.auto_open||!value.celebration_id||attempted.current===value.celebration_id||locallySeen(value.celebration_id))return;
    let cancelled=false;let timer=0;
    const attempt=()=>{
      if(cancelled||attempted.current===value.celebration_id||locallySeen(value.celebration_id!))return;
      const blocked=document.visibilityState!=='visible'||Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')).some(el=>el.getClientRects().length>0);
      if(blocked){timer=window.setTimeout(attempt,1500);return;}
      attempted.current=value.celebration_id;birthday.openWelcome();
    };
    timer=window.setTimeout(attempt,700);return()=>{cancelled=true;window.clearTimeout(timer);};
  },[birthday.status?.auto_open,birthday.status?.celebration_id]);
  useEffect(()=>{
    if(!birthday.welcomeOpen)return;
    setWished(false);setBurst(0);
    if(birthday.status?.celebration_id){attempted.current=birthday.status.celebration_id;try{sessionStorage.setItem(`frienden:birthday-seen:${birthday.status.celebration_id}`,'1');}catch{/* Server acknowledgement remains the primary record. */}}
    void api.acknowledgeBirthday().then(birthday.update).catch(()=>{});
  },[birthday.welcomeOpen]);
  const unseal=(id:number)=>setLetter(id);
  if(!birthday.welcomeOpen)return null;
  const variables={'--birthday-hero':`url("${birthdayAssets.hero}")`,'--birthday-corner':`url("${birthdayAssets.corner}")`} as CSSProperties;
  return createPortal(<div className="birthday-welcome-backdrop" data-overlay-layer style={variables}><section className="birthday-welcome" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="birthday-welcome-title"><OverlayScope root={root}>
    <div className="birthday-welcome-art"><img src={birthdayAssets.hero} width={1024} height={1536} alt="" fetchPriority="high"/></div>
    <div className="birthday-welcome-copy"><span className="birthday-wordmark">Frienden</span><span className="birthday-eyebrow">{t('birthday.forYou',{name:session?.user.name??''})}</span><h1 id="birthday-welcome-title">{t('birthday.welcomeTitle')}</h1><p className="birthday-english" lang="en">Bloom into your next chapter.</p><p className="birthday-wish-copy">{t(wished?'birthday.wishKept':'birthday.welcomeCopy')}</p><p className="birthday-signature">{t('birthday.fromFrienden')}</p>
      {birthday.status?.letters.length?<div className="birthday-letters">{birthday.status.letters.map(envelope=><button type="button" className="birthday-envelope" key={envelope.letter_id} disabled={opening!==null} onClick={()=>void unseal(envelope.letter_id)}><span className="birthday-envelope-art" aria-hidden="true"><img src={birthdayAssets.corner} alt=""/></span><span><small>{t(envelope.source==='platform'?'birthday.fromPlatform':'birthday.fromSpace',{name:envelope.sender_name})}</small><strong>{envelope.title}</strong><em>{opening===envelope.letter_id?t('common.loading'):t(envelope.opened_at?'birthday.readAgain':'birthday.unseal')}</em></span><span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span></button>)}</div>:null}
      <div className="birthday-welcome-actions"><button className="button" onClick={()=>{if(wished){close();return;}setWished(true);setBurst(value=>value+1);}}>{t(wished?'birthday.wishKeptShort':'birthday.makeWish')}<span className="material-symbols-outlined" aria-hidden="true">{wished?'arrow_forward':'auto_awesome'}</span></button><button className="ghost-button" onClick={close}>{t('birthday.continue')}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></div>
    </div><button type="button" className="birthday-welcome-close" aria-label={t('common.close')} onClick={close}><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
    <BirthdayLetterReader letterId={letter} onClose={()=>setLetter(null)} onOpened={()=>void birthday.refresh()}/>
    <BirthdayRibbons burst={burst}/>
  </OverlayScope></section></div>,document.body);
}
