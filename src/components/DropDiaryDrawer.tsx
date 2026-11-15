import {useEffect,useRef,useState} from 'react';
import {SideDrawer} from './SideDrawer';
import {FeedbackState} from './FeedbackState';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {useDropDiary} from '../lib/dropDiaryResource';
import {shareClock,type DropDiaryEntry} from '../lib/dropDiary';
import {DROP_ICON} from '../lib/dropPicker';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {musicTime} from '../lib/musicLyrics';
import './DropDiaryCard.css';

function DiaryAudio({url,recording,alive}:{url:string;recording:DropDiaryEntry['audio'][number];alive:()=>boolean}){
  const {t}=useI18n(),audio=useRef<HTMLAudioElement>(null),request=useRef<AbortController|null>(null),lease=useRef(0),pendingSeek=useRef(0),mounted=useRef(true);
  const [busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[error,setError]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(recording.duration_seconds??0);
  useEffect(()=>{const element=audio.current;mounted.current=true;return()=>{mounted.current=false;request.current?.abort();if(element){element.pause();element.removeAttribute('src');element.load();releaseMediaPlayback(element);}};},[]);
  async function toggle(){
    const element=audio.current;if(!element||!alive()||busy)return;
    if(!element.paused){element.pause();return;}
    setBusy(true);setError(false);
    const controller=new AbortController();request.current=controller;
    const timeout=setTimeout(()=>controller.abort('timeout'),12000);
    try{
      if(!element.src||performance.now()>=lease.current||error){
        const started=performance.now(),value=await api.dropDiaryAudio(url,recording.id,controller.signal);
        if(controller.signal.aborted||!alive())return;
        if(value.status!=='ready'||!value.url||!value.expires_in)throw Error();
        pendingSeek.current=element.ended?0:element.currentTime||0;lease.current=started+Math.max(0,value.expires_in-3)*1000;
        element.src=value.url;element.load();
      }
      if(!alive())return;
      await element.play();
    }catch{if(mounted.current&&(!controller.signal.aborted||controller.signal.reason==='timeout'))setError(true);}
    finally{clearTimeout(timeout);if(mounted.current)setBusy(false);}
  }
  return <div className="drop-diary-audio"><audio ref={audio} preload="none" onLoadedMetadata={e=>{if(Number.isFinite(e.currentTarget.duration)){setDuration(e.currentTarget.duration);e.currentTarget.currentTime=Math.min(pendingSeek.current,e.currentTarget.duration);}}} onPlay={e=>{claimMediaPlayback(e.currentTarget);setPlaying(true);}} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setTime(0);}} onError={()=>{setError(true);setPlaying(false);setBusy(false);}} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/><button type="button" disabled={busy} onClick={()=>void toggle()} aria-label={t(error?'common.retry':playing?'media.pause':'media.play')}><span className="material-symbols-outlined" aria-hidden="true">{busy?'hourglass_top':error?'refresh':playing?'pause':'play_arrow'}</span></button><div><input type="range" min={0} max={duration||0} step="0.1" value={Math.min(time,duration||0)} aria-label={t('music.progress')} disabled={!audio.current?.src||!duration} onChange={e=>{if(audio.current&&alive())audio.current.currentTime=Number(e.target.value);}}/><span>{error?t('drop.audioFailed'):`${musicTime(time)} / ${musicTime(duration)}`}</span></div></div>;
}

export function DropDiaryDrawer({url,open,onClose}:{url:string;open:boolean;onClose:()=>void}){
  const {t,locale}=useI18n(),resource=useDropDiary(url,open,true),clock=shareClock(resource.remaining);
  const expiry=t('drop.expiresIn',{time:clock.days?t('drop.remainingDays',{count:clock.days,clock:clock.clock}):clock.clock});
  return <SideDrawer open={open} onClose={onClose} title={t('drop.diaryTitle')} historyKey="drop-diary" className="drop-diary-drawer" titleAccessory={<span className="drop-diary-drawer-brand"><img src={DROP_ICON} alt=""/>{t('drop.shortName')}</span>} headerAction={resource.ready?<a className="icon-button" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={t('drop.open')} onClick={e=>{if(!resource.isAlive())e.preventDefault();}}><span className="material-symbols-outlined" aria-hidden="true">north_east</span></a>:undefined}>
    <div className="drop-diary-reading">
      {!resource.data?<FeedbackState tone="loading" title={t('common.loading')}/>:!resource.ready?<FeedbackState tone={resource.expired?'empty':'error'} title={t(resource.expired?'drop.shareGone':'drop.diaryFailed')} action={!resource.expired?<button type="button" className="ghost-button" onClick={resource.refresh}>{t('common.retry')}</button>:undefined}/>:<>
        <div className="drop-diary-reading-meta"><span>{t('drop.diaryCount',{count:resource.data.count??0})}</span><span>{expiry}</span></div>
        {resource.data.entries?.map((entry,index)=>{
          const date=entry.occurred_at?new Date(entry.occurred_at):null;
          const coordinates=Number.isFinite(entry.latitude)&&Number.isFinite(entry.longitude)?`${entry.latitude!.toFixed(4)}, ${entry.longitude!.toFixed(4)}`:'';
          return <article key={index} className="drop-diary-entry">
            {date&&Number.isFinite(date.getTime())?<time dateTime={entry.occurred_at}>{new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date)}</time>:null}
            {entry.text?<p className="drop-diary-body">{entry.text}</p>:null}
            {entry.audio.map(recording=><DiaryAudio key={recording.id} url={url} recording={recording} alive={resource.isAlive}/>)}
            {entry.city||entry.place||coordinates?<div className="drop-diary-location"><span className="material-symbols-outlined" aria-hidden="true">location_on</span><span>{[entry.city,entry.place].filter(Boolean).join(' · ')}{coordinates?<small>{coordinates}</small>:null}</span></div>:null}
          </article>;
        })}
      </>}
    </div>
  </SideDrawer>;
}
