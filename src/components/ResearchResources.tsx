import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { uploadMessageMedia } from '../lib/messageUpload';
import { resourcePath } from '../lib/researchResources';
import { useI18n } from '../lib/language';
import type { ResearchResource, ResearchResourceSpace } from '../lib/research';
import { SideDrawer } from './SideDrawer';
import { ConfirmDialog } from './ConfirmDialog';
import { QuietState } from './BoundaryState';
import './ResearchResources.css';

export function ResearchResources({projectId,taskId='',title,onClose}:{projectId:number;taskId?:string;title:string;onClose:()=>void}) {
  const {t}=useI18n();
  const [space,setSpace]=useState<ResearchResourceSpace|null>(null),[parent,setParent]=useState<number|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
  const [adding,setAdding]=useState<'folder'|'link'|null>(null),[name,setName]=useState(''),[url,setUrl]=useState('');
  const [deleting,setDeleting]=useState<ResearchResource|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{const controller=new AbortController();api.researchResources(projectId,taskId,controller.signal).then(setSpace).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[projectId,taskId]);
  const path=resourcePath(space?.items||[],parent);
  const items=(space?.items||[]).filter(item=>item.parent_id===parent).sort((a,b)=>Number(b.kind==='folder')-Number(a.kind==='folder')||a.name.localeCompare(b.name));
  async function change(body:Record<string,unknown>){setBusy(true);setError('');try{await api.researchResourceAction(projectId,taskId,body);setSpace(await api.researchResources(projectId,taskId));setAdding(null);setDeleting(null);}catch(e){setError(e instanceof Error?e.message:t('research.failed'));}finally{setBusy(false);}}
  async function upload(file:File){setBusy(true);setProgress(0);setError('');try{const uploaded=await uploadMessageMedia(file,'file',setProgress);await api.researchResourceAction(projectId,taskId,{action:'add',kind:'file',parent_id:parent,name:file.name,resource_id:uploaded.resource.resource_id});setSpace(await api.researchResources(projectId,taskId));}catch(e){setError(e instanceof Error?e.message:t('research.failed'));}finally{setBusy(false);}}
  async function open(item:ResearchResource){if(item.kind==='folder'){setParent(item.id);return;}const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;setError('');try{const result=await api.researchResourceAction<{url:string}>(projectId,taskId,{action:'open',id:item.id});if(popup)popup.location.href=result.url;else setError(t('resources.popup'));}catch(e){popup?.close();setError(e instanceof Error?e.message:t('research.failed'));}}
  function add(kind:'folder'|'link'){setName('');setUrl('');setError('');setAdding(kind);}
  return <SideDrawer open title={title} historyKey={`research-resources-${taskId||'project'}`} onClose={()=>{if(!busy)onClose();}}>
    <div className="research-resources">
      <nav className="resource-breadcrumbs" aria-label={t('resources.location')}><button onClick={()=>setParent(null)}>{t('resources.title')}</button>{path.map(item=><span key={item.id}><span aria-hidden="true">/</span><button onClick={()=>setParent(item.id)}>{item.name}</button></span>)}</nav>
      {space?.writable&&<div className="resource-actions"><button className="ghost-button" disabled={busy} onClick={()=>fileInput.current?.click()}><span className="material-symbols-outlined" aria-hidden="true">upload_file</span>{t('resources.upload')}</button><button className="ghost-button" disabled={busy} onClick={()=>add('link')}><span className="material-symbols-outlined" aria-hidden="true">add_link</span>{t('resources.addLink')}</button>{!taskId&&path.length<2&&<button className="ghost-button" disabled={busy} onClick={()=>add('folder')}><span className="material-symbols-outlined" aria-hidden="true">create_new_folder</span>{t('resources.addFolder')}</button>}<input ref={fileInput} type="file" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(file);}}/></div>}
      {busy&&<p role="status" className="research-muted">{progress>0&&progress<1?`${t('resources.uploading')} ${Math.round(progress*100)}%`:t('common.loading')}</p>}
      {error&&<p role="alert" className="research-error">{error}<button className="ghost-button" onClick={()=>{setError('');void api.researchResources(projectId,taskId).then(setSpace).catch(e=>setError(e.message));}}>{t('common.retry')}</button></p>}
      {!space&&!error?<QuietState title={t('common.loading')}/>:space&&<>{!space.writable&&<p className="research-muted">{t('resources.readOnly')}</p>}<div className="resource-list">{items.map(item=><div className="resource-item" key={item.id}><button className="resource-open" disabled={busy} onClick={()=>void open(item)}><span className={`resource-symbol material-symbols-outlined is-${item.kind}`} aria-hidden="true">{item.kind==='folder'?'folder':item.kind==='link'?'link':'draft'}</span><span><strong>{item.name}</strong><small>{item.kind==='file'?`${((item.size||0)/1024/1024).toLocaleString(undefined,{maximumFractionDigits:1})} MB`:t(item.kind==='folder'?'resources.folder':'resources.link')}</small></span><span className="material-symbols-outlined" aria-hidden="true">{item.kind==='folder'?'chevron_right':'open_in_new'}</span></button>{space.writable&&item.can_delete&&<button className="resource-delete ghost-button" disabled={busy} aria-label={`${t('resources.delete')} ${item.name}`} onClick={()=>{setError('');setDeleting(item);}}><span className="material-symbols-outlined" aria-hidden="true">delete</span></button>}</div>)}</div>{!items.length&&<QuietState icon="folder_open" title={t('resources.empty')} description={t(taskId?'resources.taskHint':'resources.projectHint')}/>}</>}
    </div>
    <ConfirmDialog open={!!adding} title={t(adding==='folder'?'resources.addFolder':'resources.addLink')} description="" busy={busy} confirmDisabled={!name.trim()||(adding==='link'&&!/^https?:\/\//i.test(url.trim()))} onClose={()=>setAdding(null)} onConfirm={()=>void change({action:'add',kind:adding,parent_id:parent,name,url})}><div className="resource-form"><label>{t('research.name')}<input autoFocus maxLength={180} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label>{adding==='link'&&<label>{t('resources.link')}<input type="url" inputMode="url" placeholder="https://" maxLength={2048} value={url} onChange={event=>setUrl(event.target.value)} disabled={busy}/></label>}{error&&<p role="alert" className="research-error">{error}</p>}</div></ConfirmDialog>
    <ConfirmDialog open={!!deleting} title={t('resources.delete')} description={deleting?.name||''} danger busy={busy} onClose={()=>setDeleting(null)} onConfirm={()=>void change({action:'delete',id:deleting?.id})}>{error&&<p role="alert" className="research-error">{error}</p>}</ConfirmDialog>
  </SideDrawer>;
}
