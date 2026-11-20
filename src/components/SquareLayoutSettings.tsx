import {useI18n} from '../lib/language';
import {useSquareChannelLayout, useSquareLayoutUnified} from '../lib/useSquareFeedLayout';
import type {SquareFeedLayout} from '../lib/squareFeedLayout';
import {SettingGroup, SettingRow, SettingSelect, SettingSwitch} from './SettingRow';

export function SquareLayoutSettings({scope}: {scope: string | null}) {
  const {t} = useI18n();
  const [unified, setUnified] = useSquareLayoutUnified(scope);
  const [explore, setExplore] = useSquareChannelLayout(scope, 'explore');
  const [friends, setFriends] = useSquareChannelLayout(scope, 'friends');
  const [user, setUser] = useSquareChannelLayout(scope, 'user');
  const options: {value: SquareFeedLayout; label: string}[] = [
    {value: 'list', label: t('square.layoutList')},
    {value: 'masonry', label: t('square.layoutMasonry')},
  ];
  return <>
    <SettingGroup><SettingRow title={t('square.layoutUnified')} description={t('square.layoutUnifiedHint')}
      trailing={<SettingSwitch checked={unified} label={t('square.layoutUnified')} onChange={setUnified}/>}/></SettingGroup>
    {!unified && <SettingGroup>
      <SettingSelect label={t('square.layoutExplore')} value={explore} onChange={setExplore} options={options}/>
      <SettingSelect label={t('square.layoutFriends')} value={friends} onChange={setFriends} options={options}/>
      <SettingSelect label={t('square.layoutUser')} value={user} onChange={setUser} options={options}/>
    </SettingGroup>}
  </>;
}
