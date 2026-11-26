import { useState } from 'react';
import type { ResearchMember } from '../lib/research';
import { useI18n } from '../lib/language';
import { UserAvatar } from './UserAvatar';
import { MemberPickerSheet } from './MemberPickerSheet';

export function ResearchMemberGrid({ members, onMember, onAdd, onRemove }: { members: ResearchMember[]; onMember?: (member: ResearchMember) => void; onAdd?: () => void; onRemove?: () => void }) {
  const { t } = useI18n();
  return <div className="chat-detail-member-grid research-member-grid">
    {members.map(member => <button type="button" key={member.id} className={`chat-detail-member-item${member.owner ? ' is-owner' : ''}`} disabled={!onMember || member.owner} onClick={() => onMember?.(member)} title={member.name}>
      <UserAvatar className="chat-detail-member-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>
      <span className="chat-detail-member-name"><span className="chat-detail-member-label">{member.name}</span></span>
    </button>)}
    {onAdd && <button className="chat-detail-member-item chat-detail-member-add" type="button" onClick={onAdd}><span className="chat-detail-member-avatar chat-detail-member-avatar-add"><span className="material-symbols-outlined" aria-hidden="true">add</span></span><span className="chat-detail-member-name">{t('common.add')}</span></button>}
    {onRemove && <button className="chat-detail-member-item chat-detail-member-add" type="button" onClick={onRemove}><span className="chat-detail-member-avatar chat-detail-member-avatar-add chat-detail-member-avatar-remove"><svg aria-hidden="true" className="chat-detail-member-remove-icon" fill="none" viewBox="0 0 24 24"><path d="M6.5 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2"/></svg></span><span className="chat-detail-member-name">{t('research.remove')}</span></button>}
  </div>;
}

export function ResearchAssigneesField({ members, selected, onChange, disabled }: {
  members: ResearchMember[]; selected: number[]; onChange: (ids: number[]) => void; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const people = members.filter(member => selected.includes(member.id));
  return <div className="research-assignees-field">
    <button className="research-assignees-trigger" type="button" disabled={disabled} onClick={() => setOpen(true)}>
      <span><strong>{t('research.assignees')}</strong><small>{people.length ? people.map(member => member.name).join(' · ') : t('research.selectMembers')}</small></span>
      <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
    </button>
    {open && <MemberPickerSheet title={t('research.assignees')} members={members.map(member => ({ ...member, description: member.owner ? t('research.owner') : undefined }))}
      initial={selected} onClose={() => setOpen(false)} onApply={onChange}/>}
  </div>;
}
