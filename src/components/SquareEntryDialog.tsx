import {useState} from 'react';
import {useI18n} from '../lib/language';
import type {SquareEntryChannel} from '../lib/interfacePreferences';
import {showToast} from '../lib/toast';
import {SettingGroup, SettingRow} from './SettingRow';
import {SettingsDialog} from './SettingsDialog';

const channels = [
  {value: 'friends', label: 'square.feedFriends', icon: 'group'},
  {value: 'explore', label: 'square.feedAll', icon: 'explore'},
] as const;

export function SquareEntryDialog({open, value, onChoose, onClose}: {
  open: boolean;
  value: SquareEntryChannel | null;
  onChoose: (channel: SquareEntryChannel) => Promise<void>;
  onClose: () => void;
}) {
  const {t} = useI18n();
  const [saving,setSaving]=useState(false);
  const choose=async (channel:SquareEntryChannel)=>{
    setSaving(true);
    try { await onChoose(channel); }
    catch (error) {
      if (!(error instanceof DOMException && error.name==='AbortError')) showToast(t('common.saveFailed'),'error');
    } finally { setSaving(false); }
  };
  return <SettingsDialog open={open} onClose={()=>{if(!saving)onClose();}} title={t('square.entryTitle')}>
    <SettingGroup>
      {channels.map(channel => <SettingRow key={channel.value}
        disabled={saving}
        title={t(channel.label)}
        icon={<span className="material-symbols-outlined" aria-hidden="true">{channel.icon}</span>}
        trailing={value === channel.value ? <span className="material-symbols-outlined" aria-label={t('square.entrySelected')}>check</span> : undefined}
        onClick={() => void choose(channel.value)}
      />)}
    </SettingGroup>
  </SettingsDialog>;
}
