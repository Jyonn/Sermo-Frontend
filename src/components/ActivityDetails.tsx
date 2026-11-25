import {useState,type ReactNode} from 'react';
import {BottomSheet} from './BottomSheet';
import {useI18n} from '../lib/language';
import './ActivityRefinements.css';

/** Rules and reward catalogs share one quiet secondary entry across campaigns. */
export function ActivityDetails({rules,rewards,primary,overview,rulesLabel,rewardsLabel}: {
  rules: ReactNode;
  rewards?: ReactNode;
  primary?: ReactNode;
  overview?: (openRewards: () => void) => ReactNode;
  rulesLabel?: string;
  rewardsLabel?: string;
}) {
  const {t}=useI18n();
  const [page,setPage]=useState<'rules'|'rewards'|null>(null);
  const rulesTitle = rulesLabel ?? t('activity.rules');
  const rewardsTitle = rewardsLabel ?? t('activity.prizePool');
  return <>{overview?.(()=>setPage('rewards'))}<div className="activity-secondary-actions">{primary}<nav>
    <button type="button" onClick={()=>setPage('rules')}>{rulesTitle}<span aria-hidden="true">↗</span></button>
    {rewards?<button type="button" onClick={()=>setPage('rewards')}>{rewardsTitle}<span aria-hidden="true">↗</span></button>:null}
  </nav></div><BottomSheet open={page!==null} onClose={()=>setPage(null)} title={page==='rewards'?rewardsTitle:rulesTitle} bodyClassName="activity-details-sheet">{page==='rules'?rules:page==='rewards'?rewards:null}</BottomSheet></>;
}
