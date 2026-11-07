import {useState,type ReactNode} from 'react';
import {BottomSheet} from './BottomSheet';
import {useI18n} from '../lib/language';
import './ActivityRefinements.css';

/** Rules and reward catalogs share one quiet secondary entry across campaigns. */
export function ActivityDetails({rules,rewards,primary}:{rules:ReactNode;rewards?:ReactNode;primary?:ReactNode}) {
  const {t}=useI18n();
  const [page,setPage]=useState<'rules'|'rewards'|null>(null);
  return <><div className="activity-secondary-actions">{primary}<nav>
    <button type="button" onClick={()=>setPage('rules')}>{t('activity.rules')}<span aria-hidden="true">↗</span></button>
    {rewards?<button type="button" onClick={()=>setPage('rewards')}>{t('activity.prizePool')}<span aria-hidden="true">↗</span></button>:null}
  </nav></div><BottomSheet open={page!==null} onClose={()=>setPage(null)} title={t(page==='rewards'?'activity.prizePool':'activity.rules')} bodyClassName="activity-details-sheet">{page==='rules'?rules:page==='rewards'?rewards:null}</BottomSheet></>;
}
