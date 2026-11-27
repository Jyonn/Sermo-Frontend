import {useI18n} from '../lib/language';
import {useSquareChannelLayout, useSquareLayoutUnified} from '../lib/useSquareFeedLayout';
import type {SquareFeedLayout} from '../lib/squareFeedLayout';
import {SettingGroup, SettingRow, SettingSelect, SettingSwitch} from './SettingRow';
import {showToast} from '../lib/toast';

export function SquareLayoutSettings() {
  const {t} = useI18n();
  const [unified, setUnified] = useSquareLayoutUnified();
  const [explore, setExplore] = useSquareChannelLayout('explore');
  const [friends, setFriends] = useSquareChannelLayout('friends');
  const [user, setUser] = useSquareChannelLayout('user');
  const options: {value: SquareFeedLayout; label: string}[] = [
    {value: 'list', label: t('square.layoutList')},
    {value: 'masonry', label: t('square.layoutMasonry')},
  ];
  return <>
    <SettingGroup><SettingRow title={t('square.layoutUnified')} description={t('square.layoutUnifiedHint')}
      trailing={<SettingSwitch checked={unified} label={t('square.layoutUnified')} onChange={next=>void setUnified(next).catch(()=>showToast(t('common.saveFailed'),'error'))}/>}/></SettingGroup>
    {!unified && <SettingGroup>
      <SettingSelect label={t('square.layoutExplore')} value={explore} onChange={setExplore} options={options}/>
      <SettingSelect label={t('square.layoutFriends')} value={friends} onChange={setFriends} options={options}/>
      <SettingSelect label={t('square.layoutUser')} value={user} onChange={setUser} options={options}/>
    </SettingGroup>}
  </>;
}
