import {useI18n} from '../lib/language';
import type {SquareEntryChannel} from '../lib/useSquareFeedLayout';
import {SettingGroup, SettingRow} from './SettingRow';
import {SettingsDialog} from './SettingsDialog';

const channels = [
  {value: 'friends', label: 'square.feedFriends', icon: 'group'},
  {value: 'explore', label: 'square.feedAll', icon: 'explore'},
] as const;

export function SquareEntryDialog({open, value, onChoose, onClose}: {
  open: boolean;
  value: SquareEntryChannel | null;
  onChoose: (channel: SquareEntryChannel) => void;
  onClose: () => void;
}) {
  const {t} = useI18n();
  return <SettingsDialog open={open} onClose={onClose} title={t('square.entryTitle')}>
    <SettingGroup>
      {channels.map(channel => <SettingRow key={channel.value}
        title={t(channel.label)}
        icon={<span className="material-symbols-outlined" aria-hidden="true">{channel.icon}</span>}
        trailing={value === channel.value ? <span className="material-symbols-outlined" aria-label={t('square.entrySelected')}>check</span> : undefined}
        onClick={() => onChoose(channel.value)}
      />)}
    </SettingGroup>
  </SettingsDialog>;
}
