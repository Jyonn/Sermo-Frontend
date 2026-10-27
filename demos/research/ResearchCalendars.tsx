import { useState } from 'react';
import { useTheme } from '../../src/lib/theme';
import { SelectControl } from '../../src/components/SettingRow';
import { CalendarFrame } from './CalendarFrame';
import { displayURL, type CalendarRange } from './embed-bridge';
import { type Project } from './model';
import { t } from './copy';
export function ResearchCalendars({project,viewer,date,canBook,onBook}:{project:Project;viewer:number;date:string;canBook:boolean;onBook:(range:CalendarRange,members:number[])=>void}) {
  const key=`research-display-sessions-${project.id}-${viewer}`;
  const {resolvedTheme}=useTheme();
  const [links,setLinks]=useState<Record<string,string>>(()=>{try{return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(key)||'{}')).flatMap(([id,url])=>typeof url==='string'&&displayURL(url)?[[id,url]]:[]));}catch{return {};}});
  const [chosen,setChosen]=useState<number[]>([viewer]),[editing,setEditing]=useState(false),[member,setMember]=useState(String(viewer)),[draft,setDraft]=useState(''),[error,setError]=useState('');
  const anchor=displayURL(links[viewer]||'');
  const selected=chosen.map(id=>displayURL(links[id]||''));
  const valid=!!anchor&&selected.every(item=>item?.origin===anchor.origin)&&new Set(selected.map(item=>item?.id)).size===selected.length&&selected.length<=20;
  function save(){const parsed=displayURL(draft);if(!parsed){setError(t('embedInvalid'));return;}const next={...links,[member]:parsed.url};try{localStorage.setItem(key,JSON.stringify(next));setLinks(next);setDraft('');setError('');}catch{setError(t('storageError'));}}
  return <div className="v3-embed-workspace" style={{colorScheme:resolvedTheme}}>
    <div className="v3-calendar-actions"><p className="v3-muted">{t('embedIntro')}</p><button className="r-text-button" type="button" onClick={()=>setEditing(!editing)}>{t('embedSettings')}</button></div>
    <div className="v3-calendar-members" aria-label={t('members')}>{project.members.map(m=><label key={m.id} className={chosen.includes(m.id)?'selected':''}><input type="checkbox" checked={chosen.includes(m.id)} disabled={m.id!==viewer&&!links[m.id]} onChange={e=>setChosen(old=>e.target.checked?[...old,m.id]:old.filter(id=>id!==m.id))}/><span className="r-avatar">{m.name.slice(0,1)}</span><span>{m.name}{m.id===viewer&&<small>{t('mine')}</small>}{!links[m.id]&&<small>{t('embedMissing')}</small>}</span></label>)}</div>
    {editing&&<div className="v3-calendar-link"><p className="v3-muted">{t('embedSetupHint')}</p><SelectControl label={t('members')} value={member} options={project.members.map(m=>({value:String(m.id),label:m.name}))} onChange={id=>{setMember(id);setDraft(links[id]||'');setError('');}}/><input aria-label={t('embedUrl')} type="url" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="https://chronelle.jyonn.space/binding-embed/…/"/><button type="button" className="button" onClick={save}>{t('save')}</button>{links[member]&&<button type="button" className="r-text-button" onClick={()=>{const next={...links};delete next[member];try{localStorage.setItem(key,JSON.stringify(next));setLinks(next);setChosen(ids=>ids.filter(id=>id===viewer||id!==Number(member)));}catch{setError(t('storageError'));}}}>{t('calendarUnlink')}</button>}{error&&<p role="alert" className="v3-error">{error}</p>}</div>}
    {anchor&&valid?<CalendarFrame url={anchor.url} ids={selected.map(item=>item!.id)} date={date} onRange={range=>{if(canBook)onBook(range,chosen);else setError(t('notOwner'));}}/>:<div className="v3-embed-empty"><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><h2>{t(anchor?'embedSelectionInvalid':'embedMissing')}</h2><p>{t('embedSetupHint')}</p><button className="button secondary" type="button" onClick={()=>{setMember(String(viewer));setDraft(links[viewer]||'');setEditing(true);}}>{t('embedSettings')}</button></div>}
    <p className="v3-muted">{t('embedLocalOnly')}</p>{!editing&&error&&<p role="alert" className="v3-error">{error}</p>}
  </div>;
}
