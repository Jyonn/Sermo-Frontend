import {useEffect,useRef,useState} from 'react';
import {DROP_ICON,dropShareUrl} from '../lib/dropPicker';
import {diaryExcerpt,shareClock} from '../lib/dropDiary';
import {useDropDiary} from '../lib/dropDiaryResource';
import {useI18n} from '../lib/language';
import {DropDiaryDrawer} from './DropDiaryDrawer';
import './SquareMasonryFeed.css';
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
  const text=diaryExcerpt(data?.text,data?.truncated),date=data?.occurred_at?new Date(data.occurred_at):null;
  const dateLabel=date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(date):'';
  const clock=shareClock(remaining),timeLabel=clock.days?t('drop.remainingDays',{count:clock.days,clock:clock.clock}):clock.clock;
  return <div className="drop-diary-card square-note" ref={root} onClick={event=>event.stopPropagation()} aria-busy={!data||undefined}>
    <button className="drop-diary-open" type="button" disabled={!ready} aria-label={t('drop.openDiary')} onClick={()=>{if(resource.isAlive())setOpen(true);else resource.refresh();}}>
      <div className={`square-note-cover is-text theme-2 drop-diary-paper${text.length<=30?' text-large':' text-medium'}`}>
        {!data?<div className="drop-diary-skeleton" aria-label={t('common.loading')} role="status"><i/><i/><i/></div>:<span className="square-note-lettering">{ready?text||t('drop.openDiary'):t(expired?'drop.shareGone':'drop.diaryFailed')}</span>}
      </div>
      <footer className="drop-diary-footer"><span className="drop-diary-brand"><img src={DROP_ICON} alt=""/>{t('drop.shortName')}</span><span className="drop-diary-meta">{ready?(data?.count??0)>1?t('drop.diaryCount',{count:data?.count}):dateLabel:''}</span><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></footer>
      {ready?<div className="drop-diary-expiry"><span className="material-symbols-outlined" aria-hidden="true">hourglass_empty</span>{t('drop.expiresIn',{time:timeLabel})}</div>:null}
    </button>
    {data?.status==='error'?<button type="button" className="drop-diary-retry" onClick={resource.refresh}>{t('common.retry')}</button>:null}
    {canonical&&open?<DropDiaryDrawer url={canonical} open onClose={()=>{setOpen(false);resource.refresh();}}/>:null}
  </div>;
}
