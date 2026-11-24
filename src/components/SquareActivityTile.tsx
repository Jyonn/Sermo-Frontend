import type {ReactNode} from 'react';
import type {ActivityCampaignDTO} from '../types';
import {useI18n} from '../lib/language';
import {MemberAvatarStack} from './MemberAvatarStack';

export function SquareActivityTile({activity,attention,children}:{activity:Pick<ActivityCampaignDTO,'participation'>;attention?:string;children:ReactNode}){
  const {t}=useI18n(),participation=activity.participation;
  return <article className="square-activity-tile" aria-label={attention}>
    {children}
    {attention ? <span className="square-activity-claim-dot" title={attention} aria-hidden="true"/> : null}
    <footer className="square-activity-community">
    {participation?.users.length?<MemberAvatarStack members={participation.users.map(user=>({id:user.user_id,name:user.name,uri:user.avatar_uri}))} size={29} label={t('square.activityParticipants',{count:participation.count})}/>:<><span className="square-activity-first material-symbols-outlined" aria-hidden="true">group_add</span><span>{participation?t('square.activityFirst'):t('square.activityJoin')}</span></>}
  </footer></article>;
}
