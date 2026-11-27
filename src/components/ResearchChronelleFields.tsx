import {useState} from 'react';
import {useI18n} from '../lib/language';
import {parseRecurrence, recurrenceDefaults, weekdayCodes, type Recurrence} from '../lib/chronelleRecurrence';
import {useChronelleCopy, type ChronelleGroup, type Reminder} from '../lib/researchChronelle';
import {DatePickerField} from './DatePickerField';
import {SettingSelect} from './SettingRow';
import {SettingsDialog} from './SettingsDialog';

export type Destination = {group_id:number|null; category_id:number|null};
export const noDestination:Destination = {group_id:null,category_id:null};

export function CalendarDestination({groups,value,onChange}:{
  groups:ChronelleGroup[];value:Destination;onChange:(next:Destination)=>void;
}) {
  const {copy}=useChronelleCopy();
  const selected=groups.find(group=>group.id===value.group_id);
  return <div className="research-chronelle-selects">
    <SettingSelect label={copy('calendarGroup')} value={String(value.group_id??'')}
      options={groups.map(group=>({label:group.name,value:String(group.id)}))}
      onChange={id=>onChange({group_id:Number(id),category_id:null})}/>
    <SettingSelect label={copy('category')} value={String(!value.category_id||selected?.categories.some(item=>item.id===value.category_id&&item.is_default)?'':value.category_id)}
      options={[{label:copy('defaultCategory'),value:''},...(selected?.categories??[])
        .filter(item=>!item.is_default).map(item=>({label:item.name,value:String(item.id)}))]}
      onChange={id=>onChange({...value,category_id:id?Number(id):null})}/>
  </div>;
}

const frequencies=['','DAILY','WEEKLY','MONTHLY','YEARLY'] as const;
const endings=['never','until','count'] as const;
export function CalendarRepeat({start,allDay,zone,rule,value,onChange}:{
  start:string;allDay:boolean;zone:string;rule:string;value?:Recurrence;onChange:(value:Recurrence)=>void;
}) {
  const {copy}=useChronelleCopy();
  const {t,language}=useI18n();
  const [open,setOpen]=useState(false);
  const parsed=value??parseRecurrence(rule,start,allDay,zone);
  const [draft,setDraft]=useState(()=>parsed??recurrenceDefaults(start,allDay,zone));
  const patch=(values:Partial<Recurrence>)=>setDraft(current=>({...current,...values}));
  const day=(code:string, length:'short'|'long'='short')=>new Intl.DateTimeFormat(language,{weekday:length,timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+weekdayCodes.indexOf(code))));
  const monthly=draft.frequency==='MONTHLY'||draft.frequency==='YEARLY';
  const valid=!draft.frequency || (Number.isInteger(draft.interval) && draft.interval>=1 && draft.interval<=99
    && (draft.frequency!=='WEEKLY' || draft.weekdays.length>0)
    && (draft.ending!=='count'||Number.isInteger(draft.count)&&draft.count>=1&&draft.count<=9999)
    && (draft.ending!=='until'||draft.until>=recurrenceDefaults(start,allDay,zone).until));
  const summary=parsed ? copy(parsed.frequency||'noRepeat') : copy('preserveRule');
  return <>
    <button type="button" className="setting-select setting-select-trigger is-row" aria-haspopup="dialog" onClick={()=>{
      setDraft(parsed??recurrenceDefaults(start,allDay,zone));setOpen(true);
    }}><strong>{copy('repeat')}</strong><span className="setting-select-value">{summary}</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
    <SettingsDialog open={open} title={copy('repeat')} onClose={()=>setOpen(false)}>
      {!parsed && <p className="research-muted">{copy('preserveHint')}</p>}
      <div className="research-chronelle-repeat">
        <SettingSelect label={copy('frequency')} value={draft.frequency}
          options={frequencies.map(value=>({value,label:copy(value||'noRepeat')}))} onChange={frequency=>patch({frequency})}/>
        {draft.frequency && <>
          <label>{copy('interval')}<input type="number" min={1} max={99} value={draft.interval} onChange={event=>patch({interval:Number(event.target.value)})}/></label>
          {draft.frequency==='WEEKLY' && <>
            <div className="research-repeat-days" role="group" aria-label={copy('weekdays')}>{weekdayCodes.map(code=><button type="button"
              key={code} aria-pressed={draft.weekdays.includes(code)}
              onClick={()=>patch({weekdays:draft.weekdays.includes(code)?draft.weekdays.filter(item=>item!==code):[...draft.weekdays,code]})}>{day(code)}</button>)}</div>
            <SettingSelect label={copy('weekStart')} value={draft.week_start}
              options={weekdayCodes.map(value=>({value,label:day(value,'long')}))} onChange={week_start=>patch({week_start})}/>
          </>}
          {draft.frequency==='YEARLY' && <SettingSelect label={copy('month')} value={String(draft.year_month)}
            options={Array.from({length:12},(_,i)=>({value:String(i+1),label:new Intl.DateTimeFormat(language,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,i,1)))}))}
            onChange={month=>patch({year_month:Number(month)})}/>}
          {monthly && <>
            <SettingSelect label={copy('repeatPattern')} value={draft.monthly_mode}
              options={[{value:'day',label:copy('byDate')},{value:'weekday',label:copy('byWeekday')}]} onChange={monthly_mode=>patch({monthly_mode})}/>
            {draft.monthly_mode==='day' ? <SettingSelect label={copy('dayOfMonth')} value={String(draft.month_day)}
              options={Array.from({length:62},(_,i)=>i<31?i+1:30-i).map(n=>({value:String(n),label:n>0?String(n):copy('fromEnd',{count:-n})}))}
              onChange={n=>patch({month_day:Number(n)})}/> : <>
              <SettingSelect label={copy('ordinal')} value={String(draft.ordinal)}
                options={[1,2,3,4,5,-1,-2,-3,-4,-5].map(n=>({value:String(n),label:n>0?String(n):copy('fromEnd',{count:-n})}))}
                onChange={n=>patch({ordinal:Number(n)})}/>
              <SettingSelect label={copy('weekdays')} value={draft.weekday}
                options={weekdayCodes.map(value=>({value,label:day(value,'long')}))} onChange={weekday=>patch({weekday})}/>
            </>}
          </>}
          <SettingSelect label={copy('ends')} value={draft.ending} options={endings.map(value=>({value,label:copy(value)}))} onChange={ending=>patch({ending})}/>
          {draft.ending==='until' && <DatePickerField label={copy('until')} min={recurrenceDefaults(start,allDay,zone).until} value={draft.until} onChange={until=>patch({until})}/>}
          {draft.ending==='count' && <label>{copy('count')}<input type="number" min={1} max={9999} value={draft.count} onChange={event=>patch({count:Number(event.target.value)})}/></label>}
        </>}
        <button type="button" className="button" disabled={!valid} onClick={()=>{onChange(draft);setOpen(false);}}>{t('common.done')}</button>
      </div>
    </SettingsDialog>
  </>;
}

export const defaultReminder:Reminder={mode:'default',minutes:5,all_day_time:'09:00',all_day_days:0};
export function CalendarReminder({value,allDay,onChange}:{value:Reminder;allDay:boolean;onChange:(value:Reminder)=>void}) {
  const {copy}=useChronelleCopy();
  return <>
    <SettingSelect label={copy('reminder')} value={value.mode}
      options={(['default','off','custom'] as const).map(mode=>({value:mode,label:copy('reminder.'+mode)}))}
      onChange={mode=>onChange({...value,mode})}/>
    {value.mode==='custom' && (allDay ? <div className="research-chronelle-pair">
      <label>{copy('daysBefore')}<input type="number" min={0} max={7} value={value.all_day_days??0} onChange={event=>onChange({...value,all_day_days:Number(event.target.value)})}/></label>
      <label>{copy('reminderTime')}<input type="time" value={value.all_day_time} onChange={event=>onChange({...value,all_day_time:event.target.value})}/></label>
    </div> : <label>{copy('minutesBefore')}<input type="number" min={0} max={10080} value={value.minutes} onChange={event=>onChange({...value,minutes:Number(event.target.value)})}/></label>)}
  </>;
}
