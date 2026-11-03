import type {ReactNode} from 'react';
import type {ActivityCampaignDTO} from '../types';
import {useI18n} from '../lib/language';
import {PlainAvatar} from './UserAvatar';

export function SquareActivityTile({activity,children}:{activity:Pick<ActivityCampaignDTO,'participation'>;children:ReactNode}){
  const {t}=useI18n(),participation=activity.participation;
  return <article className="square-activity-tile">{children}<footer className="square-activity-community">
    {participation?.users.length?<span className="square-activity-faces" aria-hidden="true">{participation.users.map(user=><PlainAvatar key={user.user_id} className="square-activity-face" name={user.name} uri={user.avatar_uri}/>)}</span>:<span className="square-activity-first material-symbols-outlined" aria-hidden="true">group_add</span>}
    <span>{participation?participation.count?t('square.activityParticipants',{count:participation.count}):t('square.activityFirst'):t('square.activityJoin')}</span>
  </footer></article>;
}
