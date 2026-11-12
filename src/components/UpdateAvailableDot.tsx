import {useSyncExternalStore} from 'react';
import {getPwaUpdateCheckSnapshot,subscribePwaUpdateCheck} from '../lib/pwaUpdate';
import {useI18n} from '../lib/language';
import {UnreadIndicator} from './UnreadIndicator';

export function UpdateAvailableDot({fresh=false,label,navigation=false}:{fresh?:boolean;label?:string;navigation?:boolean}){
  const {t}=useI18n();
  const {result}=useSyncExternalStore(subscribePwaUpdateCheck,getPwaUpdateCheckSnapshot);
  if (!result?.updateAvailable && !fresh) return null;
  const description = result?.updateAvailable ? t('common.updateAvailable') : label ?? t('common.updateAvailable');
  return navigation ? <UnreadIndicator fresh freshLabel={description} /> : <span className="update-available-dot" role="img" aria-label={description}/>;
}
