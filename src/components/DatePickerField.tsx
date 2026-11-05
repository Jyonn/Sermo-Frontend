import {useState} from 'react';
import {BottomSheet} from './BottomSheet';
import {CalendarDatePicker} from './CalendarDatePicker';
import {useI18n} from '../lib/language';
export function DatePickerField({value,onChange,label,name,min,max,required=false}:{value:string;onChange:(date:string)=>void;label:string;name?:string;min?:string;max?:string;required?:boolean}){
  const {t}=useI18n();const [open,setOpen]=useState(false),[draft,setDraft]=useState(value);
  return <div><button className="date-picker-field-trigger" type="button" onClick={()=>{setDraft(value);setOpen(true);}}><span><small>{label}</small><strong>{value||t('calendarDate.select')}</strong></span><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span></button>{name&&<input type="hidden" name={name} value={value} required={required}/>}<BottomSheet open={open} title={label} onClose={()=>setOpen(false)} className="selection-sheet"><CalendarDatePicker value={draft} onChange={setDraft} min={min} max={max}/><div className="date-picker-field-actions">{!required&&<button type="button" className="ghost-button" onClick={()=>{onChange('');setOpen(false);}}>{t('common.clear')}</button>}<button className="button" type="button" disabled={!draft||(!!min&&draft<min)||(!!max&&draft>max)} onClick={()=>{onChange(draft);setOpen(false);}}>{t('common.done')}</button></div></BottomSheet></div>;
}
