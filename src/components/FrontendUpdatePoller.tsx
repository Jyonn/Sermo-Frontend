import {useEffect} from 'react';
import {checkForPwaUpdate} from '../lib/pwaUpdate';
import {startFrontendUpdatePolling} from '../lib/frontendUpdatePolling';
import {isPageActive} from '../lib/pageActivity';
import {showToast} from '../lib/toast';
import {i18n} from '../lib/i18n';

export function FrontendUpdatePoller(){
  useEffect(()=>{
    if(!import.meta.env.PROD)return;
    let storage:Storage|undefined;try{storage=window.localStorage}catch{/* Optional. */}
    const task=startFrontendUpdatePolling({check:checkForPwaUpdate,notify:()=>showToast(i18n.t('update.toastAvailable'),'info',3500),isActive:isPageActive,storage,clock:{setInterval:(callback,ms)=>window.setInterval(callback,ms),clearInterval:id=>window.clearInterval(id as number)}});
    document.addEventListener('visibilitychange',task.poll);
    return()=>{task.stop();document.removeEventListener('visibilitychange',task.poll)};
  },[]);
  return null;
}
