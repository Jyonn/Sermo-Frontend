import type {ExplicitUpdateCheckResult} from './pwaUpdate';

const NOTICE_KEY='frienden:frontend-release-notified';
export function startFrontendUpdatePolling({check,notify,isActive,storage,clock}:{check:()=>Promise<ExplicitUpdateCheckResult>;notify:()=>void;isActive:()=>boolean;storage?:Pick<Storage,'getItem'|'setItem'>;clock:{setInterval:(callback:()=>void,ms:number)=>unknown;clearInterval:(id:unknown)=>void}}){
  let disposed=false,pending=false,lastNotice='';
  try{lastNotice=storage?.getItem(NOTICE_KEY)??''}catch{/* Optional notice deduplication. */}
  const poll=async()=>{
    if(disposed||pending||!isActive())return;
    pending=true;
    try{
      const result=await check();
      if(disposed||result.catalogUnavailable||!result.updateAvailable||!result.latestVersion||result.latestVersion===lastNotice)return;
      lastNotice=result.latestVersion;
      try{storage?.setItem(NOTICE_KEY,lastNotice)}catch{/* Memory still prevents repeat toasts. */}
      notify();
    }catch{/* Background checks stay quiet on network failure. */}
    finally{pending=false}
  };
  const timer=clock.setInterval(()=>void poll(),3*60*1000);
  void poll();
  return {poll,stop:()=>{disposed=true;clock.clearInterval(timer)}};
}
