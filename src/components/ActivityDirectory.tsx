import {useEffect,useState} from 'react';
import {useActivityOverlay} from '../lib/activityOverlay';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {ActivityCampaignDTO,PermanentVipCampaignDTO} from '../types';
import {ActivityCampaignCard} from './ActivityCampaignCard';
import {FeedbackState} from './FeedbackState';
import {ActivityLoadingState} from './ActivityLoadingState';
import './ActivityDirectory.css';

export function ActivityDirectory({vip}:{vip?:PermanentVipCampaignDTO|null}) {
  const {t,language}=useI18n();
  const openActivity=useActivityOverlay();
  const [items,setItems]=useState<ActivityCampaignDTO[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{const refresh=()=>setAttempt(value=>value+1);window.addEventListener('frienden:activity-updated',refresh);return()=>window.removeEventListener('frienden:activity-updated',refresh);},[]);
  useEffect(()=>{
    const controller=new AbortController();
    setStatus('loading');
    void api.getActiveActivities(controller.signal).then(result=>{if(!controller.signal.aborted){setItems(result);setStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    return ()=>controller.abort();
  },[attempt]);
  const showVip=vip?.space_activity_active&&(vip.active||vip.claimed_by_user);
  if(status==='loading')return <ActivityLoadingState compact/>;
  if(status==='error')return <FeedbackState tone="error" title={t('square.activitiesLoadFailed')} action={<button className="secondary-button" type="button" onClick={()=>setAttempt(value=>value+1)}>{t('common.retry')}</button>}/>;
  if(!items.length&&!showVip)return <FeedbackState tone="empty" title={t('square.activitiesEmpty')}/>;
  return <div className="activity-directory">{items.map(activity=>{
    const progress=activity.explorer?{value:activity.explorer.completed_count,max:5}:activity.starry_night?{value:activity.starry_night.streak_days,max:activity.starry_night.target_days}:activity.friendly_neighbor?{value:activity.friendly_neighbor.web_points,max:100}:activity.bgm?{value:activity.bgm.tracks.filter(track=>track.owned).length,max:activity.bgm.tracks.length}:activity.theme==='baxian'?{value:activity.space_total,max:activity.target}:undefined;
    return <ActivityCampaignCard key={activity.key} activity={activity} title={language.startsWith('zh')?activity.title:activity.title_en||activity.title} eyebrow={t('activity.active')} hint={t('message.activityOpen')} progress={progress} onClick={()=>openActivity(activity.key)}/>;
  })}{showVip?<ActivityCampaignCard activity={{key:'permanent-vip-founding-100',theme:'permanent-vip',presentation:{palette:'gold'}}} title={t('vip.campaignTitle')} eyebrow="FOUNDING 100" hint={t(vip.claimed_by_user?'vip.permanentOwned':'vip.bannerOwnership')} onClick={()=>openActivity('permanent-vip-founding-100')}/>:null}</div>;
}
