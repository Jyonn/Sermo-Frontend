import {useState} from 'react';
import {useI18n} from '../lib/language';
import {eventOverlapsDay, eventDateRange, defaultTimezone, eventScope, useChronelleCopy, useChronelleQuery, useChronelleWrite, type CalendarEvent, type ChronelleGroup, type RecurrenceScope} from '../lib/researchChronelle';
import {meetingLocalTime, meetingRangeFromFields, newMeetingRange, shiftMeetingDay} from '../lib/researchMeetingTime';
import type {CalendarRange} from '../lib/chronelleBridge';
import type {CalendarSync} from './ResearchChronelleManage';
import {DatePickerField} from './DatePickerField';
import {SettingSelect} from './SettingRow';
import {QuietState} from './BoundaryState';
import {ConfirmDialog} from './ConfirmDialog';
import {SettingsDialog} from './SettingsDialog';
import {SideDrawer} from './SideDrawer';
import {EventOverview, ResearchChronelleEditor, type CalendarEventDraft} from './ResearchChronelleEvent';

type Intent = 'edit'|'delete'|'invite';
export type InvitationSelection = {id:string; occurrence?:string};
const dateUTC=(day:string)=>new Date(day+'T12:00:00Z');

export function ChronelleLoad({loading,error,onRetry,children}:{loading:boolean;error?:unknown;onRetry:()=>void;children:React.ReactNode}) {
  const {t}=useI18n();
  const {copy,errorText}=useChronelleCopy();
  if(loading)return <p className="research-muted" role="status">{t('common.loading')}</p>;
  if(error)return <QuietState icon="event_busy" title={copy('failed')} description={errorText(error)}
    action={<button type="button" className="ghost-button" onClick={onRetry}>{t('common.retry')}</button>}/>;
  return children;
}

export function ResearchChronelleAgenda({project,groups,writable,revision,reload,openInvitation,zone=defaultTimezone,weekStart=1,sync}:{
  project:number;groups:ChronelleGroup[];writable:boolean;revision:number;reload:()=>void;
  openInvitation:(item:InvitationSelection)=>void; zone?:string;weekStart?:number;sync?:CalendarSync;
}) {
  const {t,language}=useI18n();
  const {copy}=useChronelleCopy();
  const today=meetingLocalTime(new Date().toISOString(),zone).slice(0,10);
  const [day,setDay]=useState(today);
  const [group,setGroup]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('');
  const [newRange,setNewRange]=useState<CalendarRange>();
  const [selected,setSelected]=useState<CalendarEvent>();
  const start=shiftMeetingDay(day,-((dateUTC(day).getUTCDay()-weekStart+7)%7));
  const week=Array.from({length:7},(_,i)=>shiftMeetingDay(start,i));
  const dateRange=meetingRangeFromFields({from:start,to:week[6],startTime:'00:00',endTime:'00:00'},zone,true,Infinity);
  const result=useChronelleQuery<CalendarEvent[]>(project,'events',{
    start:dateRange.start,end:dateRange.end,...(group?{group_id:group}:{}),...(filter?{q:filter}:{}),
  },revision);
  const write=useChronelleWrite(project);
  const rows=result.value??[];
  const format=(date:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(language,{...options,timeZone:'UTC'}).format(dateUTC(date));
  const matchesFilter=(event:CalendarEvent)=>eventOverlapsDay(event,day,zone);
  const visible=rows.filter(matchesFilter);
  const stopSelect=()=>setSelected(undefined);
  return <section className="research-native-agenda" aria-label={copy('agenda')}>
    <header className="research-agenda-toolbar">
      <div>
        <button type="button" className="research-agenda-shift" aria-label={copy('previousWeek')} onClick={()=>setDay(shiftMeetingDay(day,-7))}><span aria-hidden="true" className="material-symbols-outlined">chevron_left</span></button>
        <DatePickerField label={copy('selectDate')} value={day} onChange={value=>{if(value)setDay(value);}}/>
        <button type="button" className="research-agenda-shift" aria-label={copy('nextWeek')} onClick={()=>setDay(shiftMeetingDay(day,7))}><span aria-hidden="true" className="material-symbols-outlined">chevron_right</span></button>
      </div>
      <button type="button" className="ghost-button" onClick={()=>setDay(today)}>{copy('today')}</button>
      {writable&&<button type="button" className="button" onClick={()=>{
        const range=day===today?newMeetingRange(Date.now(),zone):meetingRangeFromFields({from:day,to:day,startTime:'09:00',endTime:'09:30'},zone,false);
        setNewRange(range);
      }}><span className="material-symbols-outlined" aria-hidden="true">add</span>{copy('newEvent')}</button>}
    </header>
    <div className="research-agenda-week" role="group" aria-label={copy('week')}>
      {week.map(date=><button type="button" key={date} aria-pressed={date===day} aria-current={date===today?'date':undefined}
        aria-label={format(date,{dateStyle:'full'})} onClick={()=>setDay(date)}>
        <span>{format(date,{weekday:'short'})}</span><strong>{dateUTC(date).getUTCDate()}</strong>
        <i data-has-event={rows.some(event=>eventOverlapsDay(event,date,zone))} aria-hidden="true"/>
      </button>)}
    </div>
    <div className="research-agenda-filters">
      <form className="research-task-search" onSubmit={event=>{event.preventDefault();setFilter(search.trim());}}>
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input aria-label={copy('search')} placeholder={copy('search')} type="search" maxLength={200} value={search}
          onChange={event=>{setSearch(event.target.value);if(!event.target.value)setFilter('');}}/>
        {search&&<button type="submit" className="ghost-button">{copy('searchAction')}</button>}
      </form>
      <SettingSelect compact label={copy('calendarGroup')} value={group}
        options={[{value:'',label:copy('allCalendars')},...groups.map(item=>({value:String(item.id),label:item.name}))]} onChange={setGroup}/>
    </div>
    <ChronelleLoad loading={result.loading} error={result.error} onRetry={result.refresh}>
      <div className="research-agenda-list">
        {visible.length ? visible.map(event=><button type="button" className="research-agenda-row" key={`${event.id}:${event.start}`}
          onClick={()=>event.invitation_id?openInvitation({id:event.invitation_id,occurrence:event.recurring?event.start:undefined}):setSelected(event)}>
          <time>{event.all_day?copy('allDay'):new Intl.DateTimeFormat(language,{timeStyle:'short',timeZone:zone}).format(new Date(event.start))}</time>
          <span className="research-agenda-accent" style={{backgroundColor:event.color}} aria-hidden="true"/>
          <span className="research-agenda-copy"><strong>{event.title}</strong><small>{event.location||groups.find(group=>group.id===event.group_id)?.name||eventDateRange(event,language,zone)}</small></span>
          {event.conflict&&<span className="research-agenda-tag">{copy('syncConflict')}</span>}
          {event.tentative&&<span className="research-agenda-tag">{copy('tentative')}</span>}
          {event.recurring&&<span className="material-symbols-outlined" aria-label={copy('recurring')}>repeat</span>}
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>):<QuietState icon="event_available" title={copy(filter?'noSearchResults':'emptyDay')}/>}
      </div>
    </ChronelleLoad>
    {newRange&&<SideDrawer open showTitle title={copy('newEvent')} historyKey="research-new-event" onClose={()=>setNewRange(undefined)} className="research-workflow-drawer">
      <ResearchChronelleEditor range={newRange} groups={groups} calendarId={group?Number(group):null} remoteCalendars={sync?.calendars}
        onSave={async draft=>{await write('events','POST',draft);setNewRange(undefined);reload();}}/>
    </SideDrawer>}
    {selected&&<EventDetail key={`${selected.id}:${selected.start}`} project={project} entry={selected} groups={groups} writable={writable}
      sync={sync} onClose={stopSelect} onChanged={()=>{stopSelect();reload();}} openInvitation={openInvitation}/>}
  </section>;
}

function EventDetail({project,entry,groups,writable,sync,onClose,onChanged,openInvitation}:{
  project:number;entry:CalendarEvent;groups:ChronelleGroup[];writable:boolean;sync?:CalendarSync;
  onClose:()=>void;onChanged:()=>void;openInvitation:(item:InvitationSelection)=>void;
}) {
  const {t}=useI18n();
  const {copy,errorText}=useChronelleCopy();
  const [intent,setIntent]=useState<Intent>();
  const [scoping,setScoping]=useState<Intent>();
  const [scope,setScope]=useState<RecurrenceScope>('all');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [remoteChoice,setRemoteChoice]=useState<'local'|'remote'>();
  const rangeDetail=useChronelleQuery<CalendarEvent>(project,entry.holiday?null:`event/${entry.id}`,entry.recurring?{occurrence_start:entry.start}:undefined);
  const allDetail=useChronelleQuery<CalendarEvent>(project,intent==='edit'&&scope==='all'&&entry.recurring?`event/${entry.id}`:null);
  const event=entry.holiday?entry:rangeDetail.value;
  const writableEvent=event&&!entry.holiday&&writable;
  const repeating=Boolean(entry.recurring||event?.rrule);
  const editing=intent==='edit'||intent==='invite';
  const editSource=(intent==='edit'&&scope==='all'&&entry.recurring)?allDetail.value:event;
  const change=useChronelleWrite(project);
  function choose(action:Intent) {
    setError('');
    if(repeating)setScoping(action);
    else {setScope('all');setIntent(action);}
  }
  async function saveEvent(draft:CalendarEventDraft,emails:string[]) {
    if(!event?.revision)return;
    const context={revision:event.revision,...eventScope(scope,entry.start)};
    if(intent==='invite') {
      const result=await change<{id:string}>('invitations','POST',{...draft,event_uid:event.id,
        client_id:invitationKey,emails,revision:event.revision,...(repeating?eventScope(scope,entry.start):{})});
      onChanged();openInvitation({id:result.id});
      return;
    }
    await change(`event/${event.id}`,'PATCH',{...draft,...context});
    onChanged();
  }
  const [invitationKey]=useState(()=>crypto.randomUUID());
  async function confirmAction() {
    if(busy||!event?.revision)return;
    setBusy(true);setError('');
    try{
      if(remoteChoice)await change(`resolve/${event.id}`,'POST',{choice:remoteChoice,revision:event.revision});
      else await change(`event/${event.id}`,'DELETE',{revision:event.revision,...eventScope(scope,entry.start)});
      onChanged();
    }catch(cause){setError(errorText(cause));}
    finally{setBusy(false);}
  }
  return <SideDrawer open showTitle title={copy(intent==='invite'?'sendInvitation':editing?'editEvent':'eventDetails')}
    historyKey="research-event" className="research-workflow-drawer" onClose={onClose}>
    <ChronelleLoad loading={rangeDetail.loading} error={rangeDetail.error} onRetry={rangeDetail.refresh}>
      {event&&(!editing ? <EventOverview event={event} groups={groups}>
        {writableEvent&&<div className="research-chronelle-actions">
          {event.conflict ? <>
            <button type="button" className="ghost-button" onClick={()=>setRemoteChoice('remote')}>{copy('useRemote')}</button>
            <button type="button" className="button" onClick={()=>setRemoteChoice('local')}>{copy('useLocal')}</button>
          </> : <>
            <button type="button" className="ghost-button research-chronelle-danger" onClick={()=>choose('delete')}>{copy('deleteEvent')}</button>
            <button type="button" className="ghost-button" onClick={()=>choose('invite')}>{copy('addGuests')}</button>
            <button type="button" className="button" onClick={()=>choose('edit')}>{copy('editEvent')}</button>
          </>}
        </div>}
      </EventOverview> : <ChronelleLoad loading={allDetail.loading} error={allDetail.error} onRetry={allDetail.refresh}>
        {editSource&&<ResearchChronelleEditor key={intent+scope} initial={editSource} range={{...editSource,timezone:editSource.timezone||defaultTimezone}}
          groups={groups} remoteCalendars={sync?.calendars} repeat={scope!=='single'} invitationEmails={intent==='invite'}
          onCancel={()=>setIntent(undefined)} onSave={saveEvent}/>}
      </ChronelleLoad>)}
    </ChronelleLoad>
    <SettingsDialog open={!!scoping} title={copy('scope')} onClose={()=>setScoping(undefined)}>
      <div className="research-chronelle-scope">
        {(scoping==='invite'?['single','future']:['single','future','all']).map(value=><button key={value} type="button" className="ghost-button" onClick={()=>{
          setScope(value as RecurrenceScope);setIntent(scoping);setScoping(undefined);
        }}>{copy('scope.'+value)}</button>)}
      </div>
    </SettingsDialog>
    <ConfirmDialog open={intent==='delete'||!!remoteChoice} danger={intent==='delete'} busy={busy} title={remoteChoice?copy('syncConflict'):copy('deleteEvent')}
      description={remoteChoice?copy(remoteChoice==='remote'?'useRemote':'useLocal'):copy('scope.'+scope)}
      onClose={()=>{setIntent(undefined);setRemoteChoice(undefined);setError('');}} onConfirm={()=>void confirmAction()}>
      {error&&<p role="alert" className="research-form-error">{error}</p>}
    </ConfirmDialog>
  </SideDrawer>;
}
