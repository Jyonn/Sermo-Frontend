import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {remainingShareSeconds,type DropDiaryPreview} from './dropDiary';

/** Private-in-memory view only: expiry is anchored to server TTL and a monotonic clock. */
export function useDropDiary(url:string,enabled:boolean,detail=false) {
  const [data,setData]=useState<DropDiaryPreview|null>(null),[revision,setRevision]=useState(0);
  const [,tick]=useState(0),deadline=useRef(0),ended=useRef(false);
  useEffect(()=>{
    if(!enabled)return;
    let active=true,request:AbortController|null=null;
    deadline.current=0;ended.current=false;setData(null);
    async function load(){
      if(document.visibilityState==='hidden'||ended.current)return;
      if(deadline.current&&performance.now()>=deadline.current){ended.current=true;setData({status:'gone'});return;}
      request?.abort();const controller=new AbortController();request=controller;
      const timeout=setTimeout(()=>controller.abort('timeout'),12000),started=performance.now();
      try{
        const value=await (detail?api.dropDiaryDetails(url,controller.signal):api.dropDiaryPreview(url,controller.signal));
        if(!active||controller.signal.aborted)return;
        if(value.status==='ready'){
          if(!Number.isFinite(value.remaining_seconds)||!value.expires_at)throw Error();
          deadline.current=started+Math.max(0,value.remaining_seconds!)*1000;
          if(performance.now()>=deadline.current){ended.current=true;setData({status:'gone'});return;}
        }else if(value.status==='gone'){ended.current=true;deadline.current=0;}
        setData(value);
      }catch{if(active&&(!controller.signal.aborted||controller.signal.reason==='timeout'))setData({status:'error'});}
      finally{clearTimeout(timeout);}
    }
    void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};
    const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;request?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[url,enabled,detail,revision]);
  useEffect(()=>{
    if(!enabled||data?.status!=='ready')return;
    const timer=setInterval(()=>{if(performance.now()>=deadline.current){ended.current=true;setData({status:'gone'});}else tick(x=>x+1);},1000);
    return()=>clearInterval(timer);
  },[enabled,data?.status]);
  const remaining=remainingShareSeconds(deadline.current,performance.now());
  const expired=data?.status==='gone'||data?.status==='ready'&&remaining<=0;
  return {data,remaining,expired,ready:data?.status==='ready'&&!expired,
    refresh:()=>setRevision(x=>x+1),isAlive:()=>data?.status==='ready'&&performance.now()<deadline.current};
}
