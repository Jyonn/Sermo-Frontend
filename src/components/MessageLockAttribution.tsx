import type {TinyUserDTO} from '../types';
import {useI18n} from '../lib/language';
import {MemberAvatarStack} from './MemberAvatarStack';
import './MessageLockAttribution.css';

export function MessageLockAttribution({users}:{users:TinyUserDTO[]}) {
  const {t}=useI18n();
  if(!users.length)return null;
  const label=t(users.length===1?'pin.by':'pin.byMany',{names:users[0].name,count:users.length});
  return <div className="message-context-lock-info" title={label}>
    <MemberAvatarStack size={22} limit={3} members={users.map(user=>({id:user.user_id,name:user.name,uri:user.avatar_uri,cacheKey:user.avatar_cache_key}))} label={<span className="message-lock-label"><span>{t('pin.byPrefix')}</span><span className="message-lock-name">{users[0].name}</span><span>{t(users.length===1?'pin.bySuffix':'pin.byManySuffix',{count:users.length})}</span></span>}/>
  </div>;
}
