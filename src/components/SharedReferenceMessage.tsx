import {lazy,Suspense,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useI18n,type TranslationKey} from '../lib/language';
import {researchReferencePath} from '../lib/messageReferences';
import type {ChatMessagePayloadDTO} from '../types';
import {PlainAvatar} from './UserAvatar';
import {SideDrawer} from './SideDrawer';
import {ContentLoader} from './BoundaryState';
import './SharedReferenceMessage.css';
const Profile=lazy(()=>import('./UserProfilePanel').then(module=>({default:module.UserProfilePanel})));

export function SharedReferenceMessage({payload}:{payload:ChatMessagePayloadDTO}) {
  const {t}=useI18n(),navigate=useNavigate(),[open,setOpen]=useState(false);
  const profile=payload.kind==='profile',person=payload.profile;
  const label=t(`references.${payload.kind}` as TranslationKey);
  const text=(profile?person?.signature:payload.text||'')?.replace(/[#*>`~_[\]]/g,'').replace(/\s+/g,' ').trim();
  return <>
    <button className="message-reference-card" type="button" disabled={payload.unavailable} onClick={event=>{event.stopPropagation();if(profile)setOpen(true);else navigate(researchReferencePath(payload));}}>
      <span className="message-reference-heading">{profile&&person?<PlainAvatar className="message-reference-avatar" name={person.name} uri={person.avatar_uri} cacheKey={person.avatar_cache_key}/>:<span className="material-symbols-outlined" aria-hidden="true">{profile?'person':payload.kind==='research_task'?'assignment':'forum'}</span>}<strong>{payload.unavailable?t('references.unavailable'):profile?person?.name:payload.title}</strong></span>
      {!payload.unavailable&&(text||payload.project_title)&&<span className="message-reference-copy">{!profile&&<small>{payload.project_title}{payload.author_name?` · ${payload.author_name}`:''}</small>}{text&&<span>{text}</span>}</span>}
      <span className="message-reference-footer"><span>{label}</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></span>
    </button>
    {profile&&<SideDrawer headerless historyKey={`shared-profile-${payload.profile_user_id}`} open={open} onClose={()=>setOpen(false)} title={t('profile.details')}>{open&&payload.profile_user_id?<Suspense fallback={<ContentLoader label={t('common.loading')}/>}><Profile userId={payload.profile_user_id} initialUser={person}/></Suspense>:null}</SideDrawer>}
  </>;
}
