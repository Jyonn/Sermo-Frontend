import {useSyncExternalStore} from 'react';
import {getPwaUpdateCheckSnapshot,subscribePwaUpdateCheck} from '../lib/pwaUpdate';
import {useI18n} from '../lib/language';

export function UpdateAvailableDot(){
  const {t}=useI18n();
  const {result}=useSyncExternalStore(subscribePwaUpdateCheck,getPwaUpdateCheckSnapshot);
  return result?.updateAvailable?<span className="update-available-dot" role="img" aria-label={t('common.updateAvailable')}/>:null;
}
