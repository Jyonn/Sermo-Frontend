import {useState, type FormEvent, type ReactNode} from 'react';
import {useI18n} from '../lib/language';
import type {CalendarRange} from '../lib/chronelleBridge';
import type {Recurrence} from '../lib/chronelleRecurrence';
import {calendarTimezone, chronelleDate, eventDateRange, type ChronelleGroup, type Reminder, type CalendarEvent, useChronelleCopy} from '../lib/researchChronelle';
import {meetingLocalTime, meetingRangeFromFields, shiftMeetingDay} from '../lib/researchMeetingTime';
import {CalendarDestination, CalendarReminder, CalendarRepeat, defaultReminder, type Destination} from './ResearchChronelleFields';
import {DatePickerField} from './DatePickerField';
import {SettingRow, SettingSelect, SettingSwitch} from './SettingRow';
import {ConfirmDialog} from './ConfirmDialog';

function fieldsFor(event:CalendarRange) {
  const start=event.all_day?event.start.slice(0,10)+'T09:00':meetingLocalTime(event.start,event.timezone);
  const end=event.all_day?shiftMeetingDay(event.end.slice(0,10),-1)+'T10:00':meetingLocalTime(event.end,event.timezone);
  const [from,startTime]=start.split('T');
  const [to,endTime]=end.split('T');
  return {from,to,startTime,endTime};
}

export type CalendarEventDraft = Pick<CalendarEvent,'title'|'start'|'end'|'all_day'> & {
  timezone:string;description:string;location:string;private_note:string;reminder:Reminder;group_id:number;
  category_id:number|null;remote_id?:number|null;recurrence?:Recurrence;rrule?:string;
};

export function EventOverview({event,groups,children}: {event:CalendarEvent;groups:ChronelleGroup[];children?:ReactNode}) {
  const {language}=useI18n();
  const {copy}=useChronelleCopy();
  const group=groups.find(group=>group.id===event.group_id);
  const category=group?.categories.find(item=>item.id===event.category_id);
  const rows=[
    ['calendar_today', eventDateRange(event,language)],
    ['place',event.location], ['label',[group?.name,category?.name].filter(Boolean).join(' · ')],
    ['repeat',event.recurring||event.rrule ? copy('recurring') : ''],
    ['notifications',event.reminder && copy('reminder.'+event.reminder.mode)],
  ];
  return <article className="research-event-overview">
    <header><h3>{event.title}</h3>{event.tentative&&<span>{copy('tentative')}</span>}</header>
    <dl>{rows.filter(([,value])=>value).map(([icon,value])=><div key={icon}><dt><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></dt><dd>{value}</dd></div>)}</dl>
    {event.description&&<p className="research-event-description">{event.description}</p>}
    {event.private_note&&<section className="research-event-private"><strong>{copy('privateNote')}</strong><p>{event.private_note}</p></section>}
    {children}
  </article>;
}

export function ResearchChronelleEditor({initial,range,groups,calendarId,timing=true,repeat=true,
  invitationEmails=false,privateFields=true,remoteCalendars=[],onSave,onCancel}:{
  initial?:CalendarEvent;range:CalendarRange;groups:ChronelleGroup[];calendarId?:number|null;
  timing?:boolean;repeat?:boolean;invitationEmails?:boolean;privateFields?:boolean;
  remoteCalendars?:{id:number;name:string;group_id:number|null;category_id:number|null;enabled:boolean;managed:boolean}[];
  onSave:(draft:CalendarEventDraft,emails:string[])=>Promise<void>;onCancel?:()=>void;
}) {
  const {t}=useI18n();
  const {copy,errorText}=useChronelleCopy();
  const original={...(initial??range),timezone:calendarTimezone(initial?.timezone??range.timezone)};
  const [timezone,setTimezone]=useState(original.timezone);
  const [fields,setFields]=useState(()=>fieldsFor(original));
  const [allDay,setAllDay]=useState(original.all_day);
  const [title,setTitle]=useState(initial?.title??'');
  const [location,setLocation]=useState(initial?.location??'');
  const [description,setDescription]=useState(initial?.description??'');
  const [note,setNote]=useState(initial?.private_note??'');
  const [invitees,setInvitees]=useState('');
  const [recurrence,setRecurrence]=useState<Recurrence>();
  const [reminder,setReminder]=useState<Reminder>(initial?.reminder??defaultReminder);
  const [destination,setDestination]=useState<Destination>({group_id:initial?.group_id??calendarId??groups[0]?.id??null,category_id:initial?.category_id??null});
  const [remote,setRemote]=useState<number|null>(initial?.remote_id??null);
  const [preview,setPreview]=useState<CalendarEventDraft>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const titleLimit=200;
  const startDate=/^\d{4}-\d\d-\d\d$/.test(fields.from)?fields.from:chronelleDate(original.start,original.all_day,timezone);
  const timezones=[...new Set([timezone,'UTC','Asia/Shanghai',...(Intl.supportedValuesOf?.('timeZone')??[])])];
  const remoteOptions=remoteCalendars.filter(item=>item.enabled&&item.group_id===destination.group_id&&
    (!item.managed||item.category_id===destination.category_id));
  function draft() {
    const group=destination.group_id;
    if(!group||!title.trim())throw new Error();
    const unchanged=JSON.stringify(fields)===JSON.stringify(fieldsFor(original))&&timezone===original.timezone&&allDay===original.all_day;
    const dates=!timing||unchanged ? original : meetingRangeFromFields(fields,timezone,allDay,Infinity);
    const start=allDay?fields.from:dates.start;
    const end=allDay?shiftMeetingDay(fields.to,1):dates.end;
    if(allDay&&(!fields.from||!fields.to||end<=start))throw new Error();
    return {title:title.trim(),location,description,private_note:note,timezone,all_day:allDay,start,end,
      group_id:group,category_id:destination.category_id,reminder, ...(remote!==null?{remote_id:remote}:{}),
      ...(recurrence?{recurrence}:{rrule:initial?.rrule??''})};
  }
  function emails() {
    return Array.from(new Set(invitees.split(/[\s,;，；]+/).map(value=>value.trim().toLowerCase()).filter(Boolean)));
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setError('');
    let value:CalendarEventDraft;
    const destinations=emails();
    try {
      value=draft();
      if(invitationEmails&&(!destinations.length||destinations.length>20||destinations.some(email=>!/^\S+@\S+\.\S+$/.test(email)))) {
        setError(copy('emailInvalid'));return;
      }
    } catch { setError(copy('invalidEvent'));return; }
    setBusy(true);
    try { await onSave(value,destinations); }
    catch(cause){setError(errorText(cause));}
    finally{setBusy(false);}
  }
  return <form className="research-form research-chronelle-editor" onSubmit={submit}>
    <fieldset disabled={busy}>
      <label>{copy('eventTitle')}<input required maxLength={titleLimit} value={title} onChange={event=>setTitle(event.target.value)}/></label>
      {invitationEmails&&<label>{copy('inviteEmails')}<input type="text" inputMode="email" maxLength={3000} value={invitees} onChange={event=>setInvitees(event.target.value)} placeholder={copy('emailPlaceholder')}/></label>}
      {timing&&<section className="research-event-time">
        <SettingRow title={copy('allDay')} trailing={<SettingSwitch checked={allDay} label={copy('allDay')} onChange={setAllDay}/>}/>
        <div className="research-chronelle-pair">
          <div><DatePickerField required label={t('research.start')} value={fields.from} onChange={from=>setFields({...fields,from,to:fields.to<=fields.from||fields.to<from?from:fields.to})}/>
            {!allDay&&<input type="time" required aria-label={copy('startTime')} value={fields.startTime} onChange={event=>setFields({...fields,startTime:event.target.value})}/>}</div>
          <div><DatePickerField required label={t('research.end')} min={fields.from} value={fields.to} onChange={to=>setFields({...fields,to})}/>
            {!allDay&&<input type="time" required aria-label={copy('endTime')} value={fields.endTime} onChange={event=>setFields({...fields,endTime:event.target.value})}/>}</div>
        </div>
        {!allDay&&<SettingSelect label={copy('timezone')} value={timezone}
          options={timezones.map(value=>({value,label:value.replace(/_/g,' ')}))} onChange={setTimezone}/>}
        {repeat&&<CalendarRepeat start={startDate} allDay={true} zone={timezone} rule={initial?.rrule??''} value={recurrence} onChange={setRecurrence}/>}
      </section>}
      <CalendarDestination groups={groups} value={destination} onChange={next=>{setDestination(next);setRemote(null);}}/>
      <label>{copy('location')}<input maxLength={500} value={location} onChange={event=>setLocation(event.target.value)}/></label>
      <label>{copy('description')}<textarea rows={3} maxLength={10000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
      {privateFields&&<details className="research-form-options" open={note||reminder.mode!=='default'?true:undefined}>
        <summary>{copy('eventOptions')}</summary>
        <CalendarReminder value={reminder} allDay={allDay} onChange={setReminder}/>
        <label>{copy('privateNote')}<textarea rows={2} maxLength={10000} value={note} onChange={event=>setNote(event.target.value)}/></label>
        {remoteOptions.length>0&&!initial?.remote_id&&<SettingSelect label={copy('syncCalendar')} value={String(remote??'')}
          options={[{value:'',label:copy('automatic')},...remoteOptions.map(item=>({value:String(item.id),label:item.name}))]} onChange={id=>setRemote(id?Number(id):null)}/>}
      </details>}
    </fieldset>
    {error&&<p className="research-form-error" role="alert">{error}</p>}
    <footer className="research-chronelle-actions">
      {onCancel&&<button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>}
      <button type="button" className="ghost-button" disabled={busy||!title.trim()} onClick={()=>{
        try{setPreview(draft());setError('');}catch{setError(copy('invalidEvent'));}
      }}>{copy('preview')}</button>
      <button className="button" type="submit" disabled={busy||!title.trim()||!destination.group_id}>{busy?t('common.processing'):invitationEmails?copy('sendInvitation'):t('research.save')}</button>
    </footer>
    <ConfirmDialog open={!!preview} title={copy('preview')} description="" confirmLabel={t('common.done')} showCancelButton={false}
      onClose={()=>setPreview(undefined)} onConfirm={()=>setPreview(undefined)}>
      {preview&&<EventOverview event={{...preview,id:'draft',recurring:Boolean(preview.recurrence?.frequency||preview.rrule)}} groups={groups}/>}
    </ConfirmDialog>
  </form>;
}
