import { useState } from 'react';
import type { ResearchMember } from '../lib/research';
import { useI18n } from '../lib/language';
import { UserAvatar } from './UserAvatar';
import { MemberPickerSheet } from './MemberPickerSheet';

export function ResearchMemberGrid({ members, onMember, onAdd }: { members: ResearchMember[]; onMember?: (member: ResearchMember) => void; onAdd?: () => void }) {
  const { t } = useI18n();
  return <div className="chat-detail-member-grid research-member-grid">
    {members.map(member => <button type="button" key={member.id} className={`chat-detail-member-item${member.owner ? ' is-owner' : ''}`} disabled={!onMember || member.owner} onClick={() => onMember?.(member)} title={member.name}>
      <UserAvatar className="chat-detail-member-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>
      <span className="chat-detail-member-name"><span className="chat-detail-member-label">{member.name}</span></span>
    </button>)}
    {onAdd && <button className="chat-detail-member-item chat-detail-member-add" type="button" onClick={onAdd}><span className="chat-detail-member-avatar chat-detail-member-avatar-add"><span className="material-symbols-outlined" aria-hidden="true">add</span></span><span className="chat-detail-member-name">{t('common.add')}</span></button>}
  </div>;
}

export function ResearchAssigneesField({ members }: { members: ResearchMember[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  return <div className="research-assignees-field">
    <button className="research-assignees-trigger" type="button" onClick={() => setOpen(true)}><span><strong>{t('research.assignees')}</strong><small>{selected.length ? members.filter(member => selected.includes(member.id)).map(member => member.name).join(' · ') : t('research.selectMembers')}</small></span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
    {selected.length > 0 && <div className="research-assignee-avatars">{members.filter(member => selected.includes(member.id)).map(member => <UserAvatar key={member.id} className="mini-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>)}</div>}
    {selected.map(id => <input type="hidden" name="member" value={id} key={id}/>)}
    {open && <MemberPickerSheet title={t('research.assignees')} members={members.map(member => ({ ...member, description: member.owner ? t('research.owner') : undefined }))} initial={selected} onClose={() => setOpen(false)} onApply={setSelected}/>}
  </div>;
}
