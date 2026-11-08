import {useI18n} from '../lib/language';
import './ActivityLoadingState.css';

/** One low-cost loading motion for the directory and every activity detail. */
export function ActivityLoadingState({compact=false}:{compact?:boolean}) {
  const {t}=useI18n();
  return <div className={`activity-loading-state${compact?' is-compact':''}`} role="status" aria-live="polite">
    <div className="activity-loading-signal"><span aria-hidden="true"><i/><i/><i/></span><span>{t('common.loading')}</span></div>
    <div className="activity-loading-poster" aria-hidden="true"/>
    <div className="activity-loading-lines" aria-hidden="true"><i/><i/><i/></div>
  </div>;
}
