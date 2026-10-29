import type { Chat } from '../types';
import { UserAvatar } from './UserAvatar';
import { useI18n } from '../lib/language';
import './ChatConversationIdentity.css';

export function ChatConversationIdentity({chat,submissionStatus}:{chat:Chat;submissionStatus:string}) {
  const {t}=useI18n();
  const direct=chat.type==='direct'&&chat.purpose!=='submission';
  return <>
    <div className="avatar-wrap chat-identity-avatar"><UserAvatar className={`avatar ${direct&&chat.online?'status-online':''}`} groupMembers={chat.type==='group'&&chat.purpose!=='submission'?chat.detail.members.map(member=>({name:member.name,uri:member.avatarUri})):undefined} name={chat.title} uri={chat.avatarUri} cacheKey={chat.avatarCacheKey} frame={chat.avatarFrameStyle}/></div>
    <div className="chat-topbar-meta">
      <strong className="chat-topbar-name">
        {direct&&<span className={`chat-inline-presence${chat.online?' is-online':''}`} role="img" aria-label={t(chat.online?'presence.online':'presence.offline')} title={chat.subtitle}/>}
        <span className="chat-topbar-title-text">{chat.title}</span>
        {chat.type==='group'&&chat.purpose!=='submission'&&<span className="chat-topbar-title-count">({chat.members})</span>}
      </strong>
      {chat.purpose==='submission'?<div className="chat-topbar-status">{submissionStatus}</div>:direct&&chat.signature?<div className="chat-topbar-status chat-topbar-signature" title={chat.signature}>{chat.signature}</div>:null}
    </div>
  </>;
}
