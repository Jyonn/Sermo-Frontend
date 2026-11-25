import {useEffect,useRef,useState} from 'react';
import {DROP_ICON,dropShareUrl} from '../lib/dropPicker';
import {diaryExcerpt,shareClock} from '../lib/dropDiary';
import {useDropDiary} from '../lib/dropDiaryResource';
import {useI18n} from '../lib/language';
import {DropDiaryDrawer} from './DropDiaryDrawer';
import './DropDiaryCard.css';

export function DropDiaryCard({url}:{url:string}){
  const {t,locale}=useI18n(),root=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false),[open,setOpen]=useState(false);
  const canonical=dropShareUrl(url),resource=useDropDiary(canonical??'',visible&&!!canonical);
  const {data,ready,expired,remaining}=resource;
  useEffect(()=>{
    if(!root.current)return;
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'120px'});
    observer.observe(root.current);return()=>observer.disconnect();
  },[]);
  const text=ready?diaryExcerpt(data?.text,data?.truncated):'',date=data?.occurred_at?new Date(data.occurred_at):null;
  const dateLabel=date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(date):'';
  const count=data?.count??0;
  const clock=shareClock(remaining),timeLabel=clock.days?t('drop.remainingDays',{count:clock.days,clock:clock.clock}):clock.clock;
  return <div className="drop-diary-card" ref={root} onClick={event=>event.stopPropagation()} aria-busy={!data||undefined}>
    <button className="drop-diary-open" type="button" disabled={!ready} onClick={()=>{if(resource.isAlive())setOpen(true);else resource.refresh();}}>
      <span className="drop-diary-header">
        <span className="drop-diary-brand"><img src={DROP_ICON} width="19" height="19" alt=""/>{t('drop.shortName')}</span>
        {ready && (count>1
          ? <span className="drop-diary-meta">{t('drop.diaryCount',{count})}</span>
          : dateLabel && <time className="drop-diary-meta" dateTime={date!.toISOString()}>{dateLabel}</time>)}
      </span>
      {!data
        ? <span className="drop-diary-skeleton" role="status" aria-label={t('common.loading')}><span/><span/></span>
        : <span className={`drop-diary-excerpt${text?'':' is-muted'}`}>{ready?text||t('drop.openDiary'):t(expired?'drop.shareGone':'drop.diaryFailed')}</span>}
      {ready && <span className="drop-diary-footer">
        <span className="drop-diary-expiry">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <circle cx="8" cy="8" r="5.7"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 4.8V8l2 1.2"/>
          </svg>
          {t('drop.expiresIn',{time:timeLabel})}
        </span>
        <svg className="drop-diary-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8h8.5M8.5 4.5 12 8l-3.5 3.5"/>
        </svg>
      </span>}
    </button>
    {data?.status==='error'?<button type="button" className="drop-diary-retry" onClick={resource.refresh}>{t('common.retry')}</button>:null}
    {canonical&&open?<DropDiaryDrawer url={canonical} open onClose={()=>{setOpen(false);resource.refresh();}}/>:null}
  </div>;
}
