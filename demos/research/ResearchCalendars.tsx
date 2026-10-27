import { useEffect, useState } from 'react';
import { SelectControl } from '../../src/components/SettingRow';
import { fetchAgenda, normalizeAgenda, agendaDate, agendaEventsOn, type AgendaEvent } from '../../src/lib/chronelleAgenda';
import { calendarFromLink } from './calendar-link';
import { meetingConflict, type Project } from './model';
import { t } from './copy';
type Result={state:'loading'|'error'|'ready';events:AgendaEvent[]};
export function ResearchCalendars({project,date,canBook,onBook}:{project:Project;date:string;canBook:boolean;onBook:(slot:string)=>void}) {
  const key=`research-public-calendars-${project.id}`;
  const [links,setLinks]=useState<Record<string,string>>(()=>{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return Object.fromEntries(Object.entries(value||{}).flatMap(([id,link])=>typeof link==='string'&&calendarFromLink(link)?[[id,link]]:[]));}catch{return {};}});
  const [results,setResults]=useState<Record<string,Result>>({});
  const [selected,setSelected]=useState(String(project.members[0]?.id??''));
  const [link,setLink]=useState(''),[error,setError]=useState(''),[editing,setEditing]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    setResults({});
    let disposed=false;
    for(const member of project.members) {
      const id=calendarFromLink(links[member.id]||'');if(!id)continue;
      setResults(old=>({...old,[member.id]:{state:'loading',events:[]}}));
      const start=new Date(`${date}T00:00:00`),end=new Date(start);end.setDate(end.getDate()+1);
      if(!Number.isFinite(start.getTime())){setResults(old=>({...old,[member.id]:{state:'error',events:[]}}));continue;}
      const params=new URLSearchParams({share:id,start:start.toISOString(),end:end.toISOString()});
      void fetchAgenda(params,controller.signal).then(normalizeAgenda).then(events=>{if(!controller.signal.aborted)setResults(old=>({...old,[member.id]:{state:'ready',events:agendaEventsOn(events,start)}}));}).catch(()=>{if(!disposed)setResults(old=>({...old,[member.id]:{state:'error',events:[]}}));});
    }
    return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[project.members,date,links,reload]);
  function save(){const id=calendarFromLink(link);if(!id){setError(t('calendarInvalid'));return;}const next={...links,[selected]:`https://chronelle.jyonn.space/#/share/${id}`};try{localStorage.setItem(key,JSON.stringify(next));setLinks(next);setEditing(false);setError('');}catch{setError(t('storageError'));}}
  function unlink(){const next={...links};delete next[selected];try{localStorage.setItem(key,JSON.stringify(next));setLinks(next);setLink('');setError('');}catch{setError(t('storageError'));}}
  return <>
    <div className="v3-calendar-actions"><p className="v3-muted">{t('calendarShared')}</p><button type="button" className="r-text-button" onClick={()=>setReload(n=>n+1)}>{t('calendarRefresh')}</button><button type="button" className="r-text-button" onClick={()=>setEditing(!editing)}>{t('calendarLink')}</button></div>
    {editing&&<div className="v3-calendar-link"><p className="v3-muted">{t('calendarLinkHint')}</p><SelectControl label={t('members')} value={selected} options={project.members.map(m=>({value:String(m.id),label:m.name}))} onChange={id=>{setSelected(id);setLink(links[id]||'');setError('');}}/><input aria-label={t('calendarLink')} type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://chronelle.jyonn.space/#/share/…"/><button className="button" type="button" onClick={save}>{t('save')}</button>{links[selected]&&<button type="button" className="r-text-button" onClick={unlink}>{t('calendarUnlink')}</button>}{error&&<p role="alert" className="v3-error">{error}</p>}</div>}
    <div className="v3-availability-wrap"><table className="v3-availability"><thead><tr><th>{t('selectTime')}</th>{project.members.map(m=><th key={m.id}>{m.name}</th>)}<th>{t('available')}</th></tr></thead><tbody>{Array.from({length:15},(_,i)=>i+7).map(hour=>{
      const start=`${date}T${String(hour).padStart(2,'0')}:00`,end=`${date}T${String(hour+1).padStart(2,'0')}:00`;
      const slots=project.members.map(m=>{const result=results[m.id];if(!links[m.id])return 'calendarUnknown' as const;if(!result)return 'calendarLoading' as const;if(result.state==='error')return 'calendarFailed' as const;if(result.state==='loading')return 'calendarLoading' as const;return meetingConflict(project,start,end,[m.id])||result.events.some(e=>agendaDate(e.start).getTime()<Date.parse(end)&&agendaDate(e.end).getTime()>Date.parse(start))?'busy' as const:'free' as const;});
      return <tr key={hour}><th>{hour}:00</th>{slots.map((status,i)=><td key={project.members[i].id}><span className={status==='free'?'free':'busy'}>{t(status)}</span></td>)}<td><button disabled={!canBook||!slots.length||slots.some(s=>s!=='free')} onClick={()=>onBook(start)}>{t('book')}</button></td></tr>;
    })}</tbody></table></div>
    <div className="v3-public-agendas">{project.members.filter(m=>results[m.id]?.state==='ready').map(m=><section key={m.id}><h3>{m.name}</h3>{results[m.id].events.length?results[m.id].events.map(e=><div className="v3-public-event" key={e.id}><time>{e.all_day?t('calendarAllDay'):`${agendaDate(e.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} – ${agendaDate(e.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`}</time><span>{e.locked?t('busy'):e.title||t('busy')}</span></div>):<p className="v3-muted">{t('calendarEmpty')}</p>}</section>)}</div>
  </>;
}
