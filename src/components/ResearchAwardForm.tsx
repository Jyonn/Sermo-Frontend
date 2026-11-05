import type {ResearchProject} from '../lib/research';
import {useState} from 'react';
import {useI18n, type TranslationKey} from '../lib/language';
import type {ResearchMutation} from './ResearchWorkflow';

export function ResearchAwardForm({project,userId,sourceId,busy,mutate,onDone}:{project:ResearchProject;userId:number;sourceId:string;busy:boolean;mutate:ResearchMutation;onDone:()=>void}){
  const {t}=useI18n();
  const [error,setError]=useState('');
  const rewards=project.workflow?.reward_types||['silver','gold','diamond'].map(id=>({id,name:'',description:''}));
  return <form className="research-form" onSubmit={event=>{event.preventDefault();setError('');const data=new FormData(event.currentTarget);void mutate({action:'award',user_id:userId,source_id:sourceId,reward_type:data.get('reward_type'),amount:Number(data.get('amount')),reason:data.get('reason')}).then(ok=>{if(ok)onDone();else setError(t('research.failed'));});}}>
    <p>{project.members.find(m=>m.id===userId)?.name}</p>
    <label>{t('researchFlow.reward')}<select name="reward_type">{rewards.map(reward=><option value={reward.id} key={reward.id}>{reward.name||t(`researchFlow.${reward.id}` as TranslationKey)}</option>)}</select></label>
    <label>{t('researchFlow.points')}<input type="number" name="amount" required min={1} max={10000}/></label>
    <label>{t('researchFlow.reason')}<textarea name="reason" required maxLength={1000}/></label>
    {error&&<p className="research-error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{t(busy?'common.loading':'researchFlow.award')}</button>
  </form>;
}
