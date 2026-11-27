import {useState,type FormEvent} from 'react';
import {useI18n} from '../lib/language';
import {defaultTimezone,eventDateRange,useChronelleCopy,useChronelleQuery,useChronelleWrite,type CalendarEvent,type ChronelleCategory,type ChronelleGroup} from '../lib/researchChronelle';
import {meetingLocalTime,shiftMeetingDay,meetingRangeFromFields} from '../lib/researchMeetingTime';
import {SettingGroup,SettingRow,SettingSelect,SettingSwitch} from './SettingRow';
import {SideDrawer} from './SideDrawer';
import {ConfirmDialog} from './ConfirmDialog';
import {PageTabs} from './PageTabs';
import {QuietState} from './BoundaryState';
import {ChronelleLoad} from './ResearchChronelleAgenda';
import {EventOverview} from './ResearchChronelleEvent';

export type CalendarPreferences={name:string;language:string;week_start:0|1;sharing_enabled:boolean;allow_invitations:boolean};
export type CalendarDefaults={enabled:boolean;minutes:number;all_day_time:string;timezone:string};
export type CalendarSync={configured:boolean;connected:boolean;status?:string;enabled?:boolean;error_message?:string;last_sync?:string;
  pending_events?:number;pending_moves?:number;sync_conflicts?:number;calendars:{id:number;name:string;group_id:number|null;category_id:number|null;managed:boolean;enabled:boolean}[]};
type Holiday={code:string;name:string;subscribed:boolean;status?:string};
type SavedCalendar={id:number;name:string;calendar_ref:string;link_valid:boolean};
type CalendarTask={id:string;title:string;note:string;status:string;deadline?:string;minutes:number;urgency:number;importance:number;event?:CalendarEvent};
type Section='collections'|'calPrefs'|'reminders'|'holidays'|'sync'|'saved'|'tasks';
const entries:Section[]=['collections','calPrefs','reminders','holidays','sync','saved','tasks'];
type CollectionEdit={kind:'group';item?:ChronelleGroup}|{kind:'category';group:ChronelleGroup;item?:ChronelleCategory};

export function ResearchChronelleManage({project,writable,groups,onClose,onChanged,revision}:{
  project:number;writable:boolean;groups:ChronelleGroup[];onClose:()=>void;onChanged:()=>void;revision:number;
}) {
  const {t,language}=useI18n();
  const {copy,errorText}=useChronelleCopy();
  const [section,setSection]=useState<Section>();
  const [pending,setPending]=useState(false);
  const [status,setStatus]=useState('');
  const [item,setItem]=useState<CollectionEdit>();
  const [archive,setArchive]=useState<ChronelleCategory>();
  const [name,setName]=useState('');
  const [color,setColor]=useState('#527b68');
  const [icon,setIcon]=useState('');
  const [shared,setShared]=useState(false);
  const [taskFilter,setTaskFilter]=useState('pending');
  const [task,setTask]=useState<string>();
  const [source,setSource]=useState<SavedCalendar>();
  const [preview,setPreview]=useState<CalendarEvent>();
  const write=useChronelleWrite(project);
  const prefs=useChronelleQuery<CalendarPreferences>(project,section==='calPrefs'?'calendar':null,undefined,revision);
  const defaults=useChronelleQuery<CalendarDefaults>(project,section==='reminders'?'reminder-preferences':null,undefined,revision);
  const holidays=useChronelleQuery<Holiday[]>(project,section==='holidays'?'holidays':null,undefined,revision);
  const sync=useChronelleQuery<CalendarSync>(project,section==='sync'?'sync':null,undefined,revision);
  const saved=useChronelleQuery<SavedCalendar[]>(project,section==='saved'?'saved-calendars':null,undefined,revision);
  const tasks=useChronelleQuery<CalendarTask[]>(project,section==='tasks'?'tasks':null,{status:taskFilter},revision);
  const taskDetail=useChronelleQuery<CalendarTask>(project,section==='tasks'&&task?`task/${task}`:null,undefined,revision);
  const date=meetingLocalTime(new Date().toISOString(),defaultTimezone).slice(0,10);
  const range=meetingRangeFromFields({from:date,to:shiftMeetingDay(date,6),startTime:'00:00',endTime:'00:00'},defaultTimezone,true,Infinity);
  const merged=useChronelleQuery<{coverage:string;events:CalendarEvent[]}>(project,section==='saved'&&source?'merged':null,
    source?{spaces:`self,${source.calendar_ref}`,start:range.start,end:range.end}:undefined,revision);
  const change=async(resource:string,method:'POST'|'PATCH'|'DELETE',body:Record<string,unknown>)=>{
    if(pending||!writable)return false;
    setPending(true);setStatus('');
    try {await write(resource,method,body);onChanged();return true;}
    catch(error){setStatus(errorText(error));return false;}
    finally{setPending(false);}
  };
  const editCollection=(value:CollectionEdit)=>{
    setStatus('');setItem(value);setName(value.item?.name??'');
    setColor(value.item?.color&&/^#[0-9a-f]{6}$/i.test(value.item.color)?value.item.color:'#527b68');
    setIcon(value.item?.icon??'');
    setShared(value.kind==='group'&&Boolean(value.item?.is_public));
  };
  async function saveCollection() {
    if(!item)return;
    const kind=item.kind==='group'?'group':'category';
    const parent=item.kind==='category'&&!item.item?{group_id:item.group.id}:{};
    if(await change(item.item?`${kind}/${item.item.id}`:kind==='group'?'groups':'categories',item.item?'PATCH':'POST',{
      ...parent,name:name.trim(),color,icon,...(item.kind==='group'?{is_public:shared}:{}),...(item.item?{revision:item.item.revision}:{}),
    }))setItem(undefined);
  }
  const saveForm=(event:FormEvent<HTMLFormElement>,resource:string,parse:(data:FormData)=>Record<string,unknown>)=>{
    event.preventDefault();
    void change(resource,'PATCH',parse(new FormData(event.currentTarget)));
  };
  function select(next?:Section) {
    setStatus('');setSection(next);setTask(undefined);setSource(undefined);setPreview(undefined);
  }
  const fileStatus=status&&<p className="research-form-error" role="alert">{status}</p>;
  return <SideDrawer open showTitle title={copy(section??'more')} historyKey="research-calendar-tools" className="research-workflow-drawer" onClose={onClose}>
    <div className="research-form research-chronelle-tools">
      {section&&<button type="button" className="ghost-button research-tools-back" onClick={()=>select()}>{copy('more')}</button>}
      {!section&&<SettingGroup>{entries.map(key=><SettingRow key={key} title={copy(key)} onClick={()=>select(key)}/>)}</SettingGroup>}
      {fileStatus}
      {section==='collections'&&<>
        {writable&&<button type="button" className="button" onClick={()=>editCollection({kind:'group'})}>{copy('newGroup')}</button>}
        {groups.map(group=><section key={group.id} className="research-calendar-collection">
          <header><h3><i style={{backgroundColor:group.color}}/>{group.name}</h3>
            {writable&&<button type="button" className="ghost-button" onClick={()=>editCollection({kind:'group',item:group})}>{copy('edit')}</button>}</header>
          <SettingGroup>
            {group.categories.map(category=><SettingRow key={category.id} title={category.name}
              description={category.is_default?copy('defaultCategory'):undefined}
              onClick={writable?()=>editCollection({kind:'category',group,item:category}):undefined}/>)}
            {writable&&<SettingRow title={copy('newCategory')} onClick={()=>editCollection({kind:'category',group})}/>}
          </SettingGroup>
        </section>)}
      </>}
      {section==='calPrefs'&&<ChronelleLoad loading={prefs.loading} error={prefs.error} onRetry={prefs.refresh}>
        {prefs.value&&<form key={revision} className="research-form" onSubmit={event=>saveForm(event,'calendar',data=>({
          name:String(data.get('name')),language:String(data.get('language')),week_start:Number(data.get('week_start')),
          sharing_enabled:data.has('sharing_enabled'),allow_invitations:data.has('allow_invitations'),
        }))}>
          <fieldset disabled={!writable||pending}>
            <label>{copy('calendarName')}<input name="name" required maxLength={100} defaultValue={prefs.value.name}/></label>
            <label>{t('menu.language')}<select name="language" defaultValue={prefs.value.language}>
              {[['auto',t('common.system')],['zh-CN','简体中文'],['zh-TW','繁體中文'],['en','English'],['ja','日本語'],['ko','한국어'],['es','Español']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>{copy('weekStart')}<select name="week_start" defaultValue={prefs.value.week_start}>
              {[0,1].map(day=><option key={day} value={day}>{new Intl.DateTimeFormat(language,{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,7+day)))}</option>)}
            </select></label>
            <label className="research-invitation-check"><input name="sharing_enabled" type="checkbox" defaultChecked={prefs.value.sharing_enabled}/>{copy('publicAvailability')}</label>
            <label className="research-invitation-check"><input name="allow_invitations" type="checkbox" defaultChecked={prefs.value.allow_invitations}/>{copy('allowInvitations')}</label>
          </fieldset>
          {writable&&<button className="button" disabled={pending}>{t('research.save')}</button>}
        </form>}
      </ChronelleLoad>}
      {section==='reminders'&&<ChronelleLoad loading={defaults.loading} error={defaults.error} onRetry={defaults.refresh}>
        {defaults.value&&<form key={revision} className="research-form" onSubmit={event=>saveForm(event,'reminder-preferences',data=>({
          enabled:data.has('enabled'),minutes:Number(data.get('minutes')),all_day_time:String(data.get('all_day_time')),timezone:String(data.get('timezone')),
        }))}>
          <fieldset disabled={!writable||pending}>
            <label className="research-invitation-check"><input name="enabled" type="checkbox" defaultChecked={defaults.value.enabled}/>{copy('enableReminders')}</label>
            <label>{copy('minutesBefore')}<input name="minutes" type="number" min={0} max={10080} required defaultValue={defaults.value.minutes}/></label>
            <label>{copy('reminderTime')}<input name="all_day_time" type="time" required defaultValue={defaults.value.all_day_time}/></label>
            <label>{copy('timezone')}<input name="timezone" list="chronelle-timezones" required maxLength={80} autoComplete="off" defaultValue={defaults.value.timezone}/>
              <datalist id="chronelle-timezones">{['UTC','Asia/Shanghai',...(Intl.supportedValuesOf?.('timeZone')??[])].filter((zone,index,list)=>list.indexOf(zone)===index).map(zone=><option key={zone} value={zone}/>)}</datalist></label>
          </fieldset>
          {writable&&<button className="button" disabled={pending}>{t('research.save')}</button>}
        </form>}
      </ChronelleLoad>}
      {section==='holidays'&&<ChronelleLoad loading={holidays.loading} error={holidays.error} onRetry={holidays.refresh}>
        <SettingGroup>{holidays.value?.map(item=><SettingRow key={item.code} title={item.name}
          trailing={<SettingSwitch label={item.name} checked={item.subscribed} disabled={!writable||pending}
            onChange={next=>void change('holidays',next?'POST':'DELETE',{code:item.code})}/>}/>)}</SettingGroup>
      </ChronelleLoad>}
      {section==='sync'&&<ChronelleLoad loading={sync.loading} error={sync.error} onRetry={sync.refresh}>
        {sync.value?.configured ? <>
          <SettingGroup><SettingRow title={copy('syncEnabled')} description={sync.value.error_message||copy(sync.value.connected?'syncConnected':'syncWaiting')}
            trailing={<SettingSwitch label={copy('syncEnabled')} checked={Boolean(sync.value.enabled)} disabled={!writable||pending} onChange={enabled=>void change('sync','PATCH',{enabled})}/>}/>
            <SettingRow title={copy('syncConflict')} value={sync.value.sync_conflicts??0}/>
            <SettingRow title={copy('syncQueue')} value={(sync.value.pending_events??0)+(sync.value.pending_moves??0)}/>
          </SettingGroup>
          {writable&&<button type="button" className="button" disabled={pending||!sync.value.enabled} onClick={()=>void change('sync','PATCH',{sync:true})}>{copy('syncNow')}</button>}
          {sync.value.calendars.map(remote=><SettingSelect key={remote.id} label={remote.name}
            value={String(remote.enabled?remote.group_id??'':'')} disabled={!writable||pending||remote.managed}
            options={[{value:'',label:copy('notLinked')},...groups.map(group=>({value:String(group.id),label:group.name}))]}
            onChange={group=>{void change('sync','PATCH',{calendar_id:remote.id,group_id:group?Number(group):null});}}/>)}
        </>:sync.value&&<QuietState icon="sync" title={copy('syncNotConfigured')}/>}
      </ChronelleLoad>}
      {section==='saved'&&<ChronelleLoad loading={saved.loading} error={saved.error} onRetry={saved.refresh}>
        {!source?(saved.value?.length ? <SettingGroup>{saved.value.map(item=><SettingRow key={item.id} title={item.name}
          description={item.link_valid?undefined:copy('missing')} onClick={item.link_valid?()=>setSource(item):undefined}/>)}</SettingGroup>
          : <QuietState icon="calendar_view_day" title={copy('noSaved')}/>):<>
          <button type="button" className="ghost-button" onClick={()=>setSource(undefined)}>{copy('saved')}</button>
          <h3>{source.name}</h3>
          <ChronelleLoad loading={merged.loading} error={merged.error} onRetry={merged.refresh}>
            {merged.value?.coverage==='unknown'&&<p className="research-muted">{copy('unknownCoverage')}</p>}
            {merged.value?.events.length ? <SettingGroup>{merged.value.events.map((event,index)=><SettingRow key={event.id+event.start+index}
              title={event.title} description={eventDateRange(event,language)} onClick={()=>setPreview(event)}/>)}</SettingGroup>
              : <QuietState icon="event_available" title={copy('emptyWeek')}/>}
          </ChronelleLoad>
        </>}
      </ChronelleLoad>}
      {section==='tasks'&&<>
        <PageTabs label={copy('tasks')} value={taskFilter} items={['pending','scheduled','done'].map(value=>({value,label:copy('task.'+value)}))}
          onChange={value=>{setTaskFilter(value);setTask(undefined);}}/>
        {task?<ChronelleLoad loading={taskDetail.loading} error={taskDetail.error} onRetry={taskDetail.refresh}>
          {taskDetail.value&&<div className="research-task-preview">
            <button type="button" className="ghost-button" onClick={()=>setTask(undefined)}>{copy('tasks')}</button>
            <h3>{taskDetail.value.title}</h3>
            {taskDetail.value.note&&<p>{taskDetail.value.note}</p>}
            <p>{copy('task.'+taskDetail.value.status)} · {copy('minutes',{count:taskDetail.value.minutes})}</p>
            {taskDetail.value.deadline&&<p>{copy('due')} · {new Date(taskDetail.value.deadline).toLocaleString(language)}</p>}
            {taskDetail.value.event&&<button type="button" className="ghost-button" onClick={()=>setPreview(taskDetail.value?.event)}>{copy('eventDetails')}</button>}
          </div>}
        </ChronelleLoad>:<ChronelleLoad loading={tasks.loading} error={tasks.error} onRetry={tasks.refresh}>
          {tasks.value?.length?<SettingGroup>{tasks.value.map(item=><SettingRow key={item.id} title={item.title}
            description={item.deadline?new Date(item.deadline).toLocaleString(language):undefined} onClick={()=>setTask(item.id)}/>)}</SettingGroup>
            :<QuietState icon="task_alt" title={copy('noTasks')}/>}
        </ChronelleLoad>}
      </>}
    </div>
    <ConfirmDialog open={!!item} title={copy(item?.item?'edit':item?.kind==='group'?'newGroup':'newCategory')} busy={pending}
      confirmDisabled={!name.trim()} confirmLabel={t('research.save')} onConfirm={()=>void saveCollection()} onClose={()=>{setItem(undefined);setStatus('');}}>
      <div className="research-form">
        <label>{t('research.name')}<input maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label>
        <div className="research-chronelle-pair"><label>{copy('color')}<input type="color" value={color} onChange={event=>setColor(event.target.value)}/></label>
          <label>{copy('icon')}<input maxLength={40} value={icon} onChange={event=>setIcon(event.target.value)}/></label></div>
        {item?.kind==='group'&&<label className="research-invitation-check"><input type="checkbox" checked={shared} onChange={event=>setShared(event.target.checked)}/>{copy('publicGroup')}</label>}
        {item?.kind==='category'&&item.item&&!item.item.is_default&&<button type="button" className="ghost-button research-chronelle-danger" onClick={()=>{setArchive(item.item);setItem(undefined);}}>{copy('archiveCategory')}</button>}
        {fileStatus}
      </div>
    </ConfirmDialog>
    <ConfirmDialog open={!!archive} title={copy('archiveCategory')} description={copy('archiveCategoryHint')} danger busy={pending} onClose={()=>{setArchive(undefined);setStatus('');}}
      onConfirm={()=>{if(archive)void change(`category/${archive.id}`,'DELETE',{revision:archive.revision}).then(done=>{if(done)setArchive(undefined);});}}>
      {fileStatus}
    </ConfirmDialog>
    <ConfirmDialog open={!!preview} title={copy('eventDetails')} showCancelButton={false} confirmLabel={t('common.done')}
      onClose={()=>setPreview(undefined)} onConfirm={()=>setPreview(undefined)}>
      {preview&&<EventOverview event={preview} groups={groups}/>}
    </ConfirmDialog>
  </SideDrawer>;
}
