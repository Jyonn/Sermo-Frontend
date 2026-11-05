import {useEffect,useId,useRef,useState} from 'react';
import {BottomSheet} from './BottomSheet';
import {useI18n} from '../lib/language';
import './DurationPickerField.css';

function DurationWheel({label,values,value,onChange}:{label:string;values:number[];value:number;onChange:(value:number)=>void}){
  const root=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>>();const scrolling=useRef(false);const id=useId();const change=useRef(onChange);change.current=onChange;
  useEffect(()=>{if(scrolling.current)return;root.current?.scrollTo({top:Math.max(0,values.indexOf(value))*44,behavior:'instant'});},[value,values.length]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div className="duration-wheel"><span>{label}</span><div ref={root} className="duration-wheel-scroll" role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={id+'-'+value} onScroll={()=>{scrolling.current=true;clearTimeout(timer.current);const index=Math.max(0,Math.min(values.length-1,Math.round((root.current?.scrollTop||0)/44)));change.current(values[index]);timer.current=setTimeout(()=>{scrolling.current=false;},140);}} onKeyDown={event=>{const delta=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:event.key==='PageDown'?5:event.key==='PageUp'?-5:0;if(!delta&&event.key!=='Home'&&event.key!=='End')return;event.preventDefault();scrolling.current=false;clearTimeout(timer.current);const index=event.key==='Home'?0:event.key==='End'?values.length-1:Math.max(0,Math.min(values.length-1,values.indexOf(value)+delta));change.current(values[index]);}}>{values.map(option=><button type="button" role="option" tabIndex={-1} id={id+'-'+option} aria-selected={value===option} key={option} onClick={()=>{scrolling.current=false;clearTimeout(timer.current);change.current(option);}}>{String(option).padStart(2,'0')}</button>)}</div></div>;
}

export function DurationPickerField({label,value,onChange,disabled=false}:{label:string;value:number;onChange:(slots:number)=>void;disabled?:boolean}){
  const {t}=useI18n();const [open,setOpen]=useState(false),[draft,setDraft]=useState(value);
  const hours=Math.floor(draft/2),minutes=draft%2*30;
  return <><button className="duration-field" type="button" disabled={disabled} onClick={()=>{setDraft(value);setOpen(true);}}><span>{label}</span><strong>{Math.floor(value/2)}<small>{t('researchFlow.hourShort')}</small>{value%2?<>30<small>{t('researchFlow.minuteShort')}</small></>:null}</strong><span className="material-symbols-outlined" aria-hidden="true">unfold_more</span></button><BottomSheet open={open} title={label} onClose={()=>setOpen(false)} className="selection-sheet"><div className="duration-picker-wheels"><DurationWheel label={t('researchFlow.hourShort')} values={Array.from({length:25},(_,i)=>i)} value={hours} onChange={hour=>setDraft(Math.min(48,hour*2+minutes/30))}/><DurationWheel label={t('researchFlow.minuteShort')} values={hours===24?[0]:[0,30]} value={minutes} onChange={minute=>setDraft(hours*2+minute/30)}/></div><footer className="duration-picker-footer"><span>{t('researchFlow.halfHourHint')}</span><button type="button" className="button" onClick={()=>{onChange(draft);setOpen(false);}}>{t('common.done')}</button></footer></BottomSheet></>;
}
