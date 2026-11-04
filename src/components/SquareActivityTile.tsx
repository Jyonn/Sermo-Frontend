import type {ReactNode} from 'react';
import type {ActivityCampaignDTO} from '../types';
import {useI18n} from '../lib/language';
import {MemberAvatarStack} from './MemberAvatarStack';

export function SquareActivityTile({activity,children}:{activity:Pick<ActivityCampaignDTO,'participation'>;children:ReactNode}){
  const {t}=useI18n(),participation=activity.participation;
  return <article className="square-activity-tile">{children}<footer className="square-activity-community">
    {participation?.users.length?<MemberAvatarStack members={participation.users.map(user=>({id:user.user_id,name:user.name,uri:user.avatar_uri}))} size={29} label={t('square.activityParticipants',{count:participation.count})}/>:<><span className="square-activity-first material-symbols-outlined" aria-hidden="true">group_add</span><span>{participation?t('square.activityFirst'):t('square.activityJoin')}</span></>}
  </footer></article>;
}
