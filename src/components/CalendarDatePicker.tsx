import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useI18n} from '../lib/language';
import {calendarDate,FIRST_YEAR,LAST_YEAR,MONTH_COUNT,monthIndex,monthDays,defaultDateRange} from '../lib/calendarDate';
import {SelectControl} from './SettingRow';
import './CalendarDatePicker.css';

const MONTH_HEIGHT=326;
export function CalendarDatePicker({value,onChange,min,max}:{value:string;onChange:(value:string)=>void;min?:string;max?:string}){
  const {t,language}=useI18n();
  const today=defaultDateRange().from;
  const selected=value||today;
  const viewport=useRef<HTMLDivElement>(null);
  const [top,setTop]=useState(monthIndex(selected)*MONTH_HEIGHT),[height,setHeight]=useState(390);
  const visible=Math.min(MONTH_COUNT-1,Math.floor(top/MONTH_HEIGHT));
  const first=Math.max(0,visible-2),last=Math.min(MONTH_COUNT,Math.ceil((top+height)/MONTH_HEIGHT)+2);
  const current=monthDays(visible);
  const jump=(index:number)=>{const next=Math.max(0,Math.min(MONTH_COUNT-1,index));viewport.current?.scrollTo({top:next*MONTH_HEIGHT,behavior:'instant'});setTop(next*MONTH_HEIGHT);};
  useLayoutEffect(()=>{jump(monthIndex(selected));const element=viewport.current;if(!element)return;const observer=new ResizeObserver(()=>setHeight(element.clientHeight));observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{const index=monthIndex(selected);const element=viewport.current;if(element&&(index*MONTH_HEIGHT<element.scrollTop||index*MONTH_HEIGHT>element.scrollTop+element.clientHeight))jump(index);},[selected]);
  const monthLabel=(year:number,month:number)=>new Intl.DateTimeFormat(language,{year:'numeric',month:'long'}).format(new Date(year,month-1,1));
  return <div className="calendar-date-picker">
    <div className="calendar-date-jump"><SelectControl label={t('datePicker.year')} value={String(current.year)} onChange={value=>jump((Number(value)-FIRST_YEAR)*12+current.month-1)} options={Array.from({length:LAST_YEAR-FIRST_YEAR+1},(_,i)=>({value:String(FIRST_YEAR+i),label:String(FIRST_YEAR+i)}))}/><SelectControl label={t('datePicker.month')} value={String(current.month)} onChange={value=>jump((current.year-FIRST_YEAR)*12+Number(value)-1)} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:new Intl.DateTimeFormat(language,{month:'long'}).format(new Date(2026,i,1))}))}/></div>
    <div className="calendar-date-weekdays" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i}>{new Intl.DateTimeFormat(language,{weekday:'narrow'}).format(new Date(2026,10,2+i))}</span>)}</div>
    <div className="calendar-date-months" ref={viewport} tabIndex={0} aria-label={t('calendarDate.browse')} onScroll={event=>setTop(event.currentTarget.scrollTop)}>
      <div style={{height:first*MONTH_HEIGHT}} aria-hidden="true"/>
      {Array.from({length:last-first},(_,i)=>first+i).map(index=>{const {year,month,offset,count}=monthDays(index);return <section className="calendar-date-month" key={index} style={{height:MONTH_HEIGHT}} aria-label={monthLabel(year,month)}><h3>{monthLabel(year,month)}</h3><div className="calendar-date-grid">{Array.from({length:42},(_,cell)=>{const day=cell-offset+1;if(day<1||day>count)return <span key={cell}/>;const date=calendarDate(year,month,day);return <button type="button" key={cell} tabIndex={date===selected?0:-1} aria-label={date} aria-pressed={date===value} aria-current={date===today?'date':undefined} disabled={!!((min&&date<min)||(max&&date>max))} onKeyDown={event=>{const delta=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?-7:event.key==='ArrowDown'?7:0;if(!delta)return;event.preventDefault();const next=new Date(year,month-1,day+delta);const candidate=calendarDate(next.getFullYear(),next.getMonth()+1,next.getDate());if(next.getFullYear()<FIRST_YEAR||next.getFullYear()>LAST_YEAR||(min&&candidate<min)||(max&&candidate>max))return;onChange(candidate);requestAnimationFrame(()=>viewport.current?.querySelector<HTMLButtonElement>(`button[aria-label="${candidate}"]`)?.focus({preventScroll:true}));}} onClick={()=>onChange(date)}>{day}</button>;})}</div></section>;})}
      <div style={{height:(MONTH_COUNT-last)*MONTH_HEIGHT+Math.max(0,height-MONTH_HEIGHT)}} aria-hidden="true"/>
    </div>
    <footer className="calendar-date-footer"><button type="button" className="ghost-button" onClick={()=>{jump(monthIndex(today));if((!min||today>=min)&&(!max||today<=max))onChange(today);}}>{t('calendarDate.today')}</button><time>{value?.split('-').join(' / ')||t('calendarDate.select')}</time></footer>
  </div>;
}
