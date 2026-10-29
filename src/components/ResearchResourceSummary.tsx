import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/language';
import type { ResearchResource } from '../lib/research';
import { formatResourceSize, resourceHost } from '../lib/researchResources';
import './ResearchResourceSummary.css';

export function ResearchResourceSummary({projectId,taskId='',refresh=0,onOpen}:{projectId:number;taskId?:string;refresh?:number;onOpen:()=>void}) {
  const {t}=useI18n(),{session}=useAuth();
  const [items,setItems]=useState<ResearchResource[]|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{const controller=new AbortController();setItems(null);setFailed(false);api.researchResources(projectId,taskId,controller.signal).then(space=>{if(!controller.signal.aborted)setItems(space.items);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[projectId,taskId,refresh,session?.user.user_id]);
  const files=items?.filter(item=>item.kind==='file').length||0,links=items?.filter(item=>item.kind==='link').length||0;
  const recent=[...(items||[])].filter(item=>item.kind!=='folder').sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,3);
  return <section className={`research-resource-summary${taskId?' is-task':''}`}>
    <header><span className="resource-summary-icon material-symbols-outlined" aria-hidden="true">{taskId?'snippet_folder':'folder_special'}</span><div><h2>{t(taskId?'resources.task':'resources.project')}</h2><p>{failed?t('resources.loadFailed'):items?t('resources.inventory',{files,links}):t('common.loading')}</p></div><button className="ghost-button" onClick={onOpen} aria-label={t('resources.view')}><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></header>
    {recent.length?<div className="resource-summary-recent">{recent.map(item=><button key={item.id} onClick={onOpen}><span className="material-symbols-outlined" aria-hidden="true">{item.kind==='link'?'link':'description'}</span><span>{item.name}</span><small>{item.kind==='link'?resourceHost(item.url):formatResourceSize(item.size)}</small></button>)}</div>:<button className="resource-summary-empty" onClick={onOpen}><span>{t(failed?'common.retry':'resources.collectHint')}</span><span className="material-symbols-outlined" aria-hidden="true">add</span></button>}
  </section>;
}
