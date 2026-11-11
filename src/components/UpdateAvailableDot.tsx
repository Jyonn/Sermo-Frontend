import {useSyncExternalStore} from 'react';
import {getPwaUpdateCheckSnapshot,subscribePwaUpdateCheck} from '../lib/pwaUpdate';
import {useI18n} from '../lib/language';

export function UpdateAvailableDot({fresh=false,label}:{fresh?:boolean;label?:string}){
  const {t}=useI18n();
  const {result}=useSyncExternalStore(subscribePwaUpdateCheck,getPwaUpdateCheckSnapshot);
  return result?.updateAvailable||fresh?<span className="update-available-dot" role="img" aria-label={result?.updateAvailable?t('common.updateAvailable'):label??t('common.updateAvailable')}/>:null;
}
