import { useEffect, useRef, useState } from 'react';
import { trustedReply, displayURL, type CalendarRange } from '../lib/chronelleBridge';
import { useI18n, type TranslationKey } from '../lib/language';
import { useTheme } from '../lib/theme';
export function CalendarFrame({url,tokens,date,onRange,onRenew}:{url:string;tokens:string[];date:string;onRange:(range:CalendarRange)=>void;onRenew?:()=>void}) {
  const {t:translate}=useI18n(),{resolvedTheme}=useTheme();
  const t=(key:string)=>translate(('research.calendarFrame.'+key) as TranslationKey);
  const frame=useRef<HTMLIFrameElement>(null),latest=useRef({tokens,date,onRange});
  latest.current={tokens,date,onRange};
  const connection=useRef({channel:'',request:'',loaded:false,ready:false});
  const timer=useRef<ReturnType<typeof setTimeout>>();
  const send=useRef<()=>void>(()=>{});
  const [state,setState]=useState('loading'),[coverage,setCoverage]=useState('unknown'),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const target=displayURL(url);if(!target)return;
    const current=frame.current;if(!current)return;
    connection.current={channel:'',request:'',loaded:false,ready:false};setState('loading');setCoverage('unknown');
    let lastDate='';
    const timeout=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{connection.current.ready=false;setState('load-failed');},20000);};
    function configure(first=false){if(!connection.current.loaded)return;connection.current.ready=false;connection.current.request=crypto.randomUUID();setState('loading');setCoverage('unknown');timeout();const dateChanged=first||lastDate!==latest.current.date;lastDate=latest.current.date;current!.contentWindow?.postMessage({protocol:'chronelle.calendar',version:2,type:first?'connect':'set-calendars',channel:connection.current.channel,request_id:connection.current.request,payload:{tokens:latest.current.tokens,...(dateChanged?{date:latest.current.date}:{})}},target!.origin);}
    send.current=()=>configure();
    const loaded=()=>{connection.current={channel:crypto.randomUUID(),request:'',loaded:true,ready:false};configure(true);};
    const receive=(event:MessageEvent)=>{
      const reply=trustedReply(event,current.contentWindow,target.origin,connection.current.channel,connection.current.request);if(!reply)return;
      if(reply.type==='state'){connection.current.ready=reply.payload.state==='ready';setState(reply.payload.state);setCoverage(reply.payload.coverage||'unknown');if(reply.payload.state!=='loading')clearTimeout(timer.current);}
      else if(connection.current.ready&&latest.current.tokens.length)latest.current.onRange(reply.payload);
    };
    window.addEventListener('message',receive);current.addEventListener('load',loaded);timeout();current.src=target.url;
    return()=>{window.removeEventListener('message',receive);current.removeEventListener('load',loaded);clearTimeout(timer.current);send.current=()=>{};};
  },[url,retry]);
  useEffect(()=>{send.current();},[tokens.join(','),date]);
  const label=state==='ready'?coverage==='complete'?'embedReady':'embedPartial':state==='permission-denied'?'embedDenied':state==='authorization-expired'?'embedExpired':state==='load-failed'?'embedFailed':'calendarLoading';
  return <div className="v3-calendar-frame research-calendar-frame" data-state={state}><div className={`v3-embed-status ${state}`} role="status"><span>{t(label)}</span>{state!=='loading'&&<button type="button" className="ghost-button" onClick={()=>onRenew?onRenew():setRetry(n=>n+1)}>{t('calendarRefresh')}</button>}{state==='login-expired'&&<a href={displayURL(url)?.origin} target="_blank" rel="noreferrer">{t('embedOpen')}</a>}</div><iframe ref={frame} title={t('iframeTitle')} style={{colorScheme:resolvedTheme}} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"/></div>;
}
