import {useState} from 'react';
import type {ResearchReward} from '../lib/research';
import {useI18n,type TranslationKey} from '../lib/language';

export function ResearchRewardEditor({reward,busy,onSave}:{reward:ResearchReward;busy:boolean;onSave:(reward:ResearchReward)=>Promise<void>}){
  const {t}=useI18n();const [name,setName]=useState(reward.name),[description,setDescription]=useState(reward.description);
  const fallback=['silver','gold','diamond'].includes(reward.id)?t(`researchFlow.${reward.id}` as TranslationKey):'';
  return <form className="research-form" onSubmit={event=>{event.preventDefault();void onSave({...reward,name:name.trim()||fallback,description:description.trim()});}}><label>{t('research.name')}<input autoFocus maxLength={40} value={name} placeholder={fallback} required={!fallback} onChange={event=>setName(event.target.value)}/></label><label>{t('research.description')}<textarea maxLength={1000} rows={4} value={description} onChange={event=>setDescription(event.target.value)}/></label><button className="button" disabled={busy||(!name.trim()&&!fallback)}>{t(busy?'common.loading':'research.save')}</button></form>;
}
