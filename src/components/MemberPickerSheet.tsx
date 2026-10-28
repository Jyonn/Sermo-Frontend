import { useState } from 'react';
import type { AvatarFrameStyle } from '../types';
import { useI18n } from '../lib/language';
import { BottomSheet } from './BottomSheet';
import { UserAvatar } from './UserAvatar';
import './SelectionSheet.css';

export type PickerMember = { id: number; name: string; avatar_uri?: string; avatar_cache_key?: string; avatar_frame_style?: AvatarFrameStyle; description?: string; locked?: boolean; lockedLabel?:string };

export function MemberPickerSheet({ title, members, initial, onClose, onApply, limit, error, actionLabel, allowEmpty = true }: {
  title: string; members: PickerMember[]; initial: number[]; onClose: () => void;
  onApply: (ids: number[]) => boolean | void | Promise<boolean | void>; limit?: number; error?: string; actionLabel?: string; allowEmpty?: boolean;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const candidates = members.filter(member => member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <BottomSheet open title={title} className="selection-sheet" showCloseButton={false} onClose={() => { if (!busy) onClose(); }} header={<div className="sheet-toolbar">
    <button className="ghost-button sheet-toolbar-button" type="button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    <div className="sheet-toolbar-title"><strong>{title}</strong></div>
    <button className="button sheet-toolbar-button" type="button" disabled={busy || (!allowEmpty && !selected.length)} onClick={async () => {
      setBusy(true); setFailed(false);
      try { if (await onApply(selected) !== false) onClose(); }
      catch { setFailed(true); }
      finally { setBusy(false); }
    }}>{busy ? t('common.processing') : actionLabel || t('common.done')}{selected.length ? ` (${selected.length})` : ''}</button>
  </div>}>
    <div className="simple-form research-member-picker">
      <label className="search-box page-search chat-member-picker-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><input className="input" placeholder={t('research.searchMembers')} aria-label={t('research.searchMembers')} value={query} onChange={event => setQuery(event.target.value)}/></label>
      {(error || failed) && <p className="research-error" role="alert">{error || t('patterns.actionFailed')}</p>}
      <div className="simple-list">{candidates.map(member => {
        const checked = selected.includes(member.id);
        const disabled = busy || member.locked || (!checked && limit !== undefined && selected.length >= limit);
        return <button type="button" key={member.id} className={`simple-row person-row checkbox-person-row${member.locked ? ' is-locked' : ''}`} aria-pressed={checked} disabled={disabled} onClick={() => setSelected(ids => checked ? ids.filter(id => id !== member.id) : [...ids, member.id])}>
          <UserAvatar className="mini-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>
          <div className="row-main"><strong>{member.name}</strong>{member.description && <div className="row-subtle">{member.description}</div>}</div>
          {member.locked ? <span className="member-picker-status member-picker-status-locked">{member.lockedLabel||t('chat.alreadyInGroup')}</span> : <span className={`member-picker-check${checked ? ' is-selected' : ''}`} aria-hidden="true"/>}
        </button>;
      })}</div>
      {!candidates.length && <p className="research-muted">{t('research.noMatchingMembers')}</p>}
    </div>
  </BottomSheet>;
}
