import {useEffect, useState, useRef} from 'react';
import {api, ApiError} from './api';
import {buildTabCacheScope} from './tabCache';
import {useAuth} from './auth';
import {useI18n, type TranslationKey} from './language';
import {meetingLocalTime, shiftMeetingDay} from './researchMeetingTime';

export type ChronelleCategory = {id:number; group_id:number; name:string; color:string; icon:string; revision:string; is_default:boolean};
export type ChronelleGroup = {id:number; name:string; color:string; icon:string; revision:string; is_public:boolean; categories:ChronelleCategory[]};
export type Reminder = {mode:'default'|'off'|'custom'; minutes:number; all_day_time:string; all_day_days?:number};
export type CalendarEvent = {
  id:string; title:string; start:string; end:string; all_day:boolean; description?:string; location?:string;
  timezone?:string; rrule?:string; revision?:string; group_id?:number|null; category_id?:number|null;
  private_note?:string; reminder?:Reminder; color?:string; holiday?:boolean; recurring?:boolean;
  tentative?:boolean; invitation_id?:string; conflict?:boolean; sync_state?:string; sync_mode?:string; remote_id?:number|null;
};
export type CalendarInvitation = CalendarEvent & {
  version:number; proposal_version:number; role:'sender'|'recipient'; status:string; my_status:string;
  sender:{name:string; avatar_url?:string}; participants:{id:number|string;name:string;status:string;organizer:boolean;reply?:string;avatar_url?:string}[];
  can_respond:boolean; can_cancel:boolean; can_withdraw:boolean; can_edit:boolean;
  can_edit_content?:boolean; my_event_uid?:string; reply?:string;
};
export type CalendarInbox = {items:CalendarInvitation[]; has_more:boolean; next_offset:number; pending_received:number};
export type RecurrenceScope = 'single'|'future'|'all';

export const defaultTimezone = 'Asia/Shanghai';
export function calendarTimezone(value?:string) {
  if(!value)return defaultTimezone;
  try { new Intl.DateTimeFormat(undefined,{timeZone:value});return value; }
  catch { return defaultTimezone; }
}
export const eventScope = (scope:RecurrenceScope, start?:string) => scope !== 'all' && start
  ? {scope, occurrence_start:start} : {scope};

export function chronelleDate(value: string, allDay: boolean, timezone: string) {
  return allDay ? value.slice(0,10) : meetingLocalTime(value,timezone).slice(0,10);
}

export function eventOverlapsDay(event:CalendarEvent,date:string,timezone:string) {
  const start=chronelleDate(event.start,event.all_day,timezone);
  const boundary=event.all_day ? event.end : new Date(new Date(event.end).getTime()-1).toISOString();
  const end=chronelleDate(boundary,event.all_day,timezone);
  return start <= date && (event.all_day ? end > date : end >= date);
}

export function eventDateRange(event:CalendarEvent, locale:string, zone=calendarTimezone(event.timezone)) {
  const format=(value:string, withDate:boolean) => new Intl.DateTimeFormat(locale, {
    ...(withDate ? {dateStyle:'medium'} as const : {}),
    ...(!event.all_day ? {timeStyle:'short'} as const : {}),
    timeZone:event.all_day?'UTC':zone,
  }).format(new Date(event.all_day ? value.slice(0,10)+'T12:00Z' : value));
  const first=chronelleDate(event.start,event.all_day,zone);
  const last=event.all_day ? shiftMeetingDay(event.end.slice(0,10),-1) : chronelleDate(event.end,false,zone);
  return event.all_day && first===last ? format(event.start,true) : `${format(event.start,true)} – ${format(event.all_day?last:event.end,first!==last)}`;
}

export function useChronelleQuery<T>(project:number, resource:string | null, query?:Record<string,string>, revision=0) {
  const [state,setState]=useState<{key:string; identity:string; value?:T; error?:unknown}>({key:'',identity:''});
  const [retry,setRetry]=useState(0);
  const params=JSON.stringify(query);
  const identity=resource ? JSON.stringify([project,resource,params]) : '';
  const key=identity ? JSON.stringify([identity,revision,retry]) : '';
  useEffect(()=>{
    if(!resource)return;
    const controller=new AbortController();
    api.researchChronelle<T>(project,resource,{query:params?JSON.parse(params):undefined,signal:controller.signal})
      .then(value=>{if(!controller.signal.aborted)setState({key,identity,value});})
      .catch(error=>{if(!controller.signal.aborted)setState({key,identity,error});});
    return()=>controller.abort();
  },[key]);
  const value=state.identity===identity?state.value:undefined;
  return {value,error:state.key===key?state.error:undefined,refreshing:Boolean(resource&&state.key!==key),
    loading:Boolean(resource&&state.key!==key&&value===undefined), refresh:()=>setRetry(n=>n+1)};
}

export function useChronelleWrite(project:number) {
  const {session}=useAuth();
  const scope=buildTabCacheScope(session?.user.space_id,session?.user.user_id);
  const keys=useRef(new Map<string,string>());
  return async <T,>(resource:string,method:'POST'|'PATCH'|'DELETE',data:Record<string,unknown>)=>{
    const fingerprint=JSON.stringify([scope,project,resource,method,data]);
    const key=keys.current.get(fingerprint) || crypto.randomUUID();
    keys.current.set(fingerprint,key);
    try {
      const result=await api.researchChronelle<T>(project,resource,{method,body:{request_key:key,data},expectedScope:scope??undefined});
      keys.current.delete(fingerprint);
      return result;
    } catch(error) {
      // Only uncertain outcomes reuse a key. The same edit can be retried
      // after the user resolves a definitive validation or permission error.
      if(error instanceof ApiError && error.status < 500)keys.current.delete(fingerprint);
      throw error;
    }
  };
}

export function useChronelleCopy() {
  const {t}=useI18n();
  const copy=(id:string,params?:Record<string,string|number>)=>t(`researchChronelle.${id}` as TranslationKey,params);
  const errorText=(cause:unknown)=>{
    const key=cause instanceof ApiError?cause.message:'';
    if(cause instanceof ApiError && cause.status===409 && /revision|operation_rejected/.test(key))return copy('conflict');
    const base=`research.calendarUI.error.${key}`;
    const existing=t(base as TranslationKey);
    return existing===base?copy(cause instanceof ApiError&&cause.status===404?'missing':'failed'):existing;
  };
  return {copy,errorText};
}
