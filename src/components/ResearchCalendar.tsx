import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useI18n, type TranslationKey } from '../lib/language';
import { chronelleOrigin } from '../lib/chronelleOrigin';
import type { ResearchProject } from '../lib/research';
import type { CalendarDisplays, CalendarSetup, ResearchMeeting } from '../lib/researchCalendar';
import { localInput, type CalendarRange } from '../lib/chronelleBridge';
import { CalendarFrame } from './ChronelleFrame';
import { ChronellePluginDialog } from './ChronellePluginDialog';
import { SideDrawer } from './SideDrawer';
import { SettingSelect } from './SettingRow';
import { ChronellePermissionsDrawer } from './ChronellePermissionsDrawer';
import { QuietState } from './BoundaryState';
import { MarkdownInput } from './ResearchMarkdownInput';
import { DrawerTabs } from './DrawerTabs';
import { UserAvatar } from './UserAvatar';
import { MemberPickerSheet } from './MemberPickerSheet';
import './ResearchCalendar.css';

export function ResearchCalendar({ project, userId, onboarding=false, onOnboarded }: { project: ResearchProject; userId: number; onboarding?:boolean;onOnboarded?:()=>void }) {
  const { t } = useI18n();
  const tr = (key: string) => t(('research.calendarUI.' + key) as TranslationKey);
  const [setup, setSetup] = useState<CalendarSetup | null>(null);
  const [selected, setSelected] = useState<number[]>([userId]);
  const [displays, setDisplays] = useState<CalendarDisplays | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [meetings,setMeetings]=useState<ResearchMeeting[]>([]);
  const [resume,setResume]=useState<ResearchMeeting|null>(null);
  const [view,setView]=useState('schedule');
  const [memberPicker,setMemberPicker]=useState(false);
  const generation = useRef(0);
  useEffect(()=>{const reload=()=>setTick(n=>n+1);window.addEventListener('chronelle:bound',reload);return()=>window.removeEventListener('chronelle:bound',reload);},[]);
  useEffect(()=>{const reload=()=>{setTick(n=>n+1);if(onboarding)onOnboarded?.();};window.addEventListener('chronelle:permissions-saved',reload);return()=>window.removeEventListener('chronelle:permissions-saved',reload);},[onboarding,onOnboarded]);
  const errorText = (code: string) => {
    const key = 'research.calendarUI.error.' + code;
    const message = t(key as TranslationKey);
    return message === key ? tr('unavailable') : message;
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDisplays(null);
    api.researchCalendar(project.id, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setSetup(value);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, tick, userId]);

  const selectionKey = selected.join(',');
  useEffect(()=>{
    const controller=new AbortController();
    api.researchMeetings(project.id,controller.signal).then(setMeetings).catch(e=>{if(!controller.signal.aborted)setError(errorText(e.message));});
    return()=>controller.abort();
  },[project.id,tick]);
  useEffect(() => {
    setRange(null); setDisplays(null);
    if (setup?.status !== 'active' || !selected.length) return;
    const controller = new AbortController();
    const request = ++generation.current;
    setLoading(true); setError('');
    api.researchCalendarAction<CalendarDisplays>(project.id, { action: 'display', members: selected }, controller.signal)
      .then(value => { if (!controller.signal.aborted && request === generation.current) setDisplays(value); })
      .catch(e => { if (!controller.signal.aborted) setError(errorText(e.message)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [setup, selectionKey, project.id]);

  useEffect(() => {
    if (!displays || range) return;
    const timer = window.setTimeout(() => setTick(n => n + 1), displays.renew_after * 1000);
    return () => window.clearTimeout(timer);
  }, [displays,range]);

  const active = setup?.status === 'active';
  return <section className="research-calendar">
    <header className="research-calendar-controls">
      <DrawerTabs label={t('research.calendar')} value={view} onChange={setView} items={[{value:'schedule',label:tr('schedule')},{value:'meetings',label:tr('meetings')}]}/>
      <div className="research-calendar-tools"><button className="ghost-button" onClick={() => setTick(n => n + 1)} disabled={loading} aria-label={t('common.retry')}><span className="material-symbols-outlined" aria-hidden="true">refresh</span></button>
      {active && <button className="ghost-button" onClick={() => setSettingsOpen(true)} aria-label={tr('visibility')}><span className="material-symbols-outlined" aria-hidden="true">tune</span><span>{tr('visibility')}</span></button>}</div>
    </header>
    {error && <p className="research-error" role="alert">{error}</p>}
    {view==='schedule'&&<>{active && <div className="research-calendar-members" role="group" aria-label={tr('members')}>
      {project.members.map(member => <label key={member.id}>
        <input type="checkbox" checked={selected.includes(member.id)} disabled={loading || (!selected.includes(member.id) && selected.length >= 20)}
          onChange={e => setSelected(ids => e.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />
        <UserAvatar className="research-calendar-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>
        {member.id === userId ? tr('self') : member.name}
      </label>)}
      <button type="button" className="ghost-button" disabled={loading} onClick={()=>setMemberPicker(true)}><span className="material-symbols-outlined" aria-hidden="true">group_add</span>{t('research.selectMembers')}</button>
    </div>}
    {loading ? <p className="research-muted" role="status">{t('common.loading')}</p> : !active ? <QuietState icon="calendar_month" title={onboarding&&setup?.status==='binding_required'?t('research.connectCalendar'):errorText(setup?.status || 'chronelle_unavailable')} description={tr('bindingHint')} action={setup?.status !== 'integration_not_configured' ? <button className="button" onClick={() => {sessionStorage.setItem(`chronelle:return-project:${userId}`,String(project.id));setConsent(true);}}>{tr('bind')}</button> : undefined}/>
    : !selected.length ? <QuietState icon="event_available" title={tr('choose')} description={tr('intro')}/> : displays?.displays.length ? <CalendarFrame
      url={displays.displays[0].url} tokens={displays.displays.map(d => d.token)} date={new Date().toLocaleDateString('en-CA')}
      onRange={value=>{setResume(null);setRange(value);}} onRenew={() => setTick(n => n + 1)} /> : null}
    </>}
    {view==='meetings'&&<section className="research-meetings">{meetings.length?meetings.map(item=><article key={item.id}><span className="research-meeting-date"><strong>{new Date(item.start).getDate()}</strong><small>{new Date(item.start).toLocaleDateString(undefined,{month:'short'})}</small></span><div><strong>{item.title}</strong><p>{new Date(item.start).toLocaleString()} → {new Date(item.end).toLocaleString()}</p><small className="research-status">{tr('meetingStatus.'+item.status)}</small></div>{item.invitation_id?<a className="ghost-button" href={`${chronelleOrigin()}/#/invitations/${item.invitation_id}`} target="_blank" rel="noreferrer">{tr('openInvitation')}<span className="material-symbols-outlined" aria-hidden="true">north_east</span></a>:item.creator_id===userId?<button className="ghost-button" onClick={()=>{setResume(item);setRange({start:item.start,end:item.end,timezone:item.timezone,all_day:item.all_day});}}>{tr('retryMeeting')}</button>:null}</article>):<div className="research-calendar-state"><span className="material-symbols-outlined" aria-hidden="true">event_available</span><h2>{tr('noMeetings')}</h2><p>{tr('meetingHint')}</p><button className="ghost-button" onClick={()=>setView('schedule')}>{tr('schedule')}</button></div>}</section>}

    {memberPicker&&<MemberPickerSheet title={tr('members')} initial={selected} members={project.members.map(member=>({...member,description:member.id===userId?tr('self'):undefined}))} limit={20} onClose={()=>setMemberPicker(false)} onApply={setSelected}/>}
    <ChronellePermissionsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} onRebind={()=>{setSettingsOpen(false);setConsent(true);}}/>
    <ChronellePluginDialog open={consent} onClose={()=>setConsent(false)} userId={userId} onChange={()=>setTick(n=>n+1)}/>
    <SideDrawer historyKey="research-meeting-create" open={!!range} fullscreen onClose={() => setRange(null)} title={tr('meeting')}>
      {range && <MeetingForm key={resume?.id||`${range.start}-${range.end}`} range={range} project={project} members={[...new Set([userId,...selected])]} groups={setup?.groups||[]} resume={resume} errorText={errorText} onDone={()=>{setRange(null);setTick(n=>n+1);}} onAttempt={()=>{void api.researchMeetings(project.id).then(setMeetings).catch(()=>{});}}/>}
    </SideDrawer>
  </section>;
}

function MeetingForm({range,project,members,groups,resume,errorText,onDone,onAttempt}:{range:CalendarRange;project:ResearchProject;members:number[];groups:CalendarSetup['groups'];resume:ResearchMeeting|null;errorText:(code:string)=>string;onDone:()=>void;onAttempt:()=>void}) {
  const {t}=useI18n();
  const tr=(key:string)=>t(('research.calendarUI.'+key) as TranslationKey);
  const [command,setCommand]=useState(()=>resume?.id||crypto.randomUUID());
  const [description,setDescription]=useState(resume?.description||'');
  const [group,setGroup]=useState(String(resume?.group_id||groups[0]?.id||''));
  const [attempt,setAttempt]=useState<Record<string,unknown>|null>(resume?{...resume,command_id:resume.id}:null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <form className="research-form" onSubmit={async event=>{
    event.preventDefault();if(busy)return;
    const form=new FormData(event.currentTarget);
    let body=attempt;
    if(!body){
      const date=(key:string)=>new Date(String(form.get(key))+(range.all_day?'T00:00':'')).toISOString();
      try{body={command_id:command,title:form.get('title'),location:form.get('location'),description,start:date('start'),end:date('end'),all_day:range.all_day,timezone:range.timezone,group_id:Number(group),members};}
      catch{setError(tr('invalidTime'));return;}
    }
    setAttempt(body);setBusy(true);setError('');
    try{await api.researchBookMeeting(project.id,body);onDone();}
    catch(e){setError(errorText(e instanceof Error?e.message:'meeting_result_unknown'));if(e instanceof ApiError&&e.status===400){setAttempt(null);setCommand(crypto.randomUUID());}}
    finally{setBusy(false);onAttempt();}
  }}>
    <p className="research-muted">{tr('selectionHint')}</p>
    <fieldset disabled={busy||!!attempt}>
      <label>{tr('meetingTitle')}<input name="title" required maxLength={160} defaultValue={resume?.title}/></label>
      <div className="research-period"><label>{t('research.start')}<input name="start" type={range.all_day?'date':'datetime-local'} required defaultValue={localInput(range.start).slice(0,range.all_day?10:16)}/></label><label>{t('research.end')}<input name="end" type={range.all_day?'date':'datetime-local'} required defaultValue={localInput(range.end).slice(0,range.all_day?10:16)}/></label></div>
      <label>{tr('location')}<input name="location" maxLength={1000} defaultValue={resume?.location}/></label>
      <SettingSelect label={tr('destination')} value={group} disabled={busy||!!attempt} options={groups.map(item=>({value:String(item.id),label:item.name}))} onChange={setGroup}/>
      <p className="research-muted">{(resume?.members||members).map(id=>project.members.find(m=>m.id===id)?.name||`#${id}`).join(' · ')}</p>
      <MarkdownInput value={description} onChange={setDescription}/>
    </fieldset>
    {error&&<p className="research-error" role="alert">{error}</p>}
    {attempt&&<p className="research-muted">{tr('sameRequest')}</p>}
    {(resume?.members||members).length<2&&<p className="research-muted">{tr('chooseInvitees')}</p>}
    <button className="button" disabled={busy||!groups.length||(resume?.members||members).length<2}>{tr(attempt?'retryMeeting':'sendInvitations')}</button>
  </form>;
}
