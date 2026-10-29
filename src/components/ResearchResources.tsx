import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { uploadMessageMedia } from '../lib/messageUpload';
import { resourcePath, visibleResources, formatResourceSize, resourceHost, resourceFileLabel } from '../lib/researchResources';
import { useI18n, getActiveLocale } from '../lib/language';
import type { ResearchMember, ResearchResource, ResearchResourceSpace } from '../lib/research';
import { SideDrawer } from './SideDrawer';
import { ConfirmDialog } from './ConfirmDialog';
import { ContentLoader, QuietState } from './BoundaryState';
import { HeaderIconButton } from './HeaderIconButton';
import { PageTabs } from './PageTabs';
import { SelectControl } from './SettingRow';
import { ActionSheet } from './ActionSheet';
import { FileDropGuide } from './FileDropGuide';
import './ResearchResources.css';

const symbol=(kind:string)=>kind==='folder'?'folder':kind==='link'?'link':'description';
export function ResearchResources({projectId,taskId='',title,members=[],onClose}:{projectId:number;taskId?:string;title:string;members?:ResearchMember[];onClose:()=>void}) {
  const {t}=useI18n();
  const [space,setSpace]=useState<ResearchResourceSpace|null>(null),[parent,setParent]=useState<number|null>(null);
  const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[sort,setSort]=useState('recent');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[uploadName,setUploadName]=useState('');
  const [addMenu,setAddMenu]=useState(false),[selected,setSelected]=useState<ResearchResource|null>(null);
  const [adding,setAdding]=useState<'folder'|'link'|null>(null),[name,setName]=useState(''),[url,setUrl]=useState('');
  const [deleting,setDeleting]=useState<ResearchResource|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [dragging,setDragging]=useState(false);
  const dragDepth=useRef(0),uploadQueue=useRef(false);
  async function uploadFiles(files:File[]){
    if(uploadQueue.current||busy||!space?.writable)return;
    uploadQueue.current=true;setBusy(true);
    try{for(const file of files){if(!await upload(file))break;}}finally{uploadQueue.current=false;setBusy(false);}
  }
  useEffect(()=>{const controller=new AbortController();api.researchResources(projectId,taskId,controller.signal).then(setSpace).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[projectId,taskId]);
  const path=resourcePath(space?.items||[],parent);
  const items=visibleResources(space?.items||[],parent,query,kind,sort);
  const folders=items.filter(item=>item.kind==='folder'),files=items.filter(item=>item.kind!=='folder');
  const contextItems=parent===null?space?.items:space?.items.filter(item=>item.parent_id===parent);
  const fileCount=contextItems?.filter(item=>item.kind==='file').length||0,linkCount=contextItems?.filter(item=>item.kind==='link').length||0;
  function navigate(id:number|null){setParent(id);setQuery('');setKind('all');}
  async function reload(){setSpace(await api.researchResources(projectId,taskId));}
  function failed(e:unknown){const message=e instanceof Error?e.message:t('research.failed');setError(message==='Directory is not empty'?t('resources.folderNotEmpty'):message==='Directory already exists'?t('resources.folderExists'):message);}
  async function change(body:Record<string,unknown>){setBusy(true);setError('');try{await api.researchResourceAction(projectId,taskId,body);await reload();if(body.action==='add'){setQuery('');setKind('all');}setAdding(null);setDeleting(null);}catch(e){failed(e);}finally{setBusy(false);}}
  async function upload(file:File){setProgress(0);setUploadName(file.name);setError('');try{const uploaded=await uploadMessageMedia(file,'file',setProgress);await api.researchResourceAction(projectId,taskId,{action:'add',kind:'file',parent_id:parent,name:file.name,resource_id:uploaded.resource.resource_id});await reload();setQuery('');setKind('all');return true;}catch(e){failed(e);return false;}finally{setUploadName('');}}
  async function open(item:ResearchResource){if(item.kind==='folder'){navigate(item.id);return;}const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;setError('');try{const result=await api.researchResourceAction<{url:string}>(projectId,taskId,{action:'open',id:item.id});if(popup)popup.location.href=result.url;else setError(t('resources.popup'));}catch(e){popup?.close();failed(e);}}
  function add(value:'folder'|'link'){setName('');setUrl('');setError('');setAdding(value);}
  function more(item:ResearchResource){return <button className="resource-more" aria-label={t('resources.actions',{name:item.name})} disabled={busy} onClick={()=>setSelected(item)}><span className="material-symbols-outlined" aria-hidden="true">more_horiz</span></button>;}
  return <SideDrawer open className="research-resource-drawer" title={title} historyKey={`research-resources-${taskId||'project'}`} headerAction={space?.writable?<HeaderIconButton label={t('resources.add')} disabled={busy} onClick={()=>setAddMenu(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>:undefined} onClose={()=>{if(!busy)onClose();}}>
    <div className="resource-library" onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current++;if(space?.writable&&!busy&&!uploadQueue.current)setDragging(true);}}} onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=space?.writable&&!busy&&!uploadQueue.current?'copy':'none';}}} onDragLeave={event=>{event.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}} onDrop={event=>{event.preventDefault();dragDepth.current=0;setDragging(false);void uploadFiles(Array.from(event.dataTransfer.files));}}>
      {dragging&&<FileDropGuide resource/>}
      <header className="resource-library-intro"><span className="resource-library-mark material-symbols-outlined" aria-hidden="true">{taskId?'assignment':'folder_special'}</span><div><span className="resource-eyebrow">{t(taskId?'resources.task':'resources.project')}</span><h2>{path[path.length-1]?.name||t('resources.library')}</h2><p>{t('resources.inventory',{files:fileCount,links:linkCount})}</p></div>{space&&!space.writable&&<span className="resource-readonly"><span className="material-symbols-outlined" aria-hidden="true">lock</span>{t('resources.archived')}</span>}</header>
      {!taskId&&<nav className="resource-breadcrumbs" aria-label={t('resources.location')}><button onClick={()=>navigate(null)} aria-current={parent===null?'page':undefined}>{t('resources.title')}</button>{path.map(item=><span key={item.id}><span aria-hidden="true">/</span><button aria-current={parent===item.id?'page':undefined} onClick={()=>navigate(item.id)}>{item.name}</button></span>)}</nav>}
      <label className="search-box resource-search"><span className="material-symbols-outlined" aria-hidden="true">search</span><input aria-label={t('resources.search')} placeholder={t('resources.search')} value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <div className="resource-toolbar"><PageTabs label={t('resources.filter')} value={kind} onChange={setKind} items={(['all','file','link'] as const).map(value=>({value,label:t(`resources.filter.${value}`)}))}/><SelectControl compact label={t('resources.sort')} value={sort} onChange={setSort} options={[{value:'recent',label:t('resources.recent')},{value:'name',label:t('resources.byName')}]}/></div>
      {uploadName&&<div className="resource-upload" role="status"><span className="material-symbols-outlined" aria-hidden="true">cloud_upload</span><div><strong>{uploadName}</strong><small>{t('resources.uploading')} · {Math.round(progress*100)}%</small><progress value={progress} max={1}/></div></div>}
      {error&&<div role="alert" className="resource-error"><span>{error}</span><button className="ghost-button" onClick={()=>{setError('');void reload().catch(failed);}}>{t('common.retry')}</button></div>}
      {!space&&!error?<ContentLoader label={t('common.loading')} rows={3}/>:space&&<>
        {!!folders.length&&<section className="resource-folder-section"><h3>{t('resources.folders')}<span>{folders.length}</span></h3><div className="resource-folder-grid">{folders.map(item=><div className="resource-folder-card" key={item.id}><button disabled={busy} onClick={()=>navigate(item.id)}><span className="material-symbols-outlined" aria-hidden="true">folder</span><strong>{item.name}</strong><small>{t('resources.itemCount',{count:space.items.filter(child=>child.parent_id===item.id).length})}</small></button>{more(item)}</div>)}</div></section>}
        {!!files.length&&<section className="resource-file-section"><h3>{t(query?'resources.results':'resources.materials')}<span>{files.length}</span></h3><div className="resource-list">{files.map(item=>{
          const creator=members.find(member=>member.id===item.creator_id);
          return <div className="resource-item" key={item.id}><button className="resource-open" disabled={busy} onClick={()=>void open(item)}><span className={`resource-symbol is-${item.kind}`}><span className="material-symbols-outlined" aria-hidden="true">{symbol(item.kind)}</span><small>{item.kind==='link'?'URL':resourceFileLabel(item.name)}</small></span><span className="resource-item-copy"><strong>{item.name}</strong><span>{item.kind==='link'?resourceHost(item.url):formatResourceSize(item.size)}</span><small>{[query?space.items.find(folder=>folder.id===item.parent_id)?.name:null,creator?.name,new Date(item.created_at).toLocaleDateString(getActiveLocale())].filter(Boolean).join(' · ')}</small></span></button>{more(item)}</div>;
        })}</div></section>}
        {!items.length&&<QuietState icon={query?'search_off':'folder_open'} title={t(query?'resources.noResults':'resources.empty')} description={t(query?'resources.searchHint':taskId?'resources.taskHint':'resources.projectHint')} action={!query&&space.writable?<button className="button" onClick={()=>setAddMenu(true)}>{t('resources.add')}</button>:undefined}/>}
      </>}
      <input ref={fileInput} type="file" multiple hidden onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void uploadFiles(files);}}/>
    </div>
    <ActionSheet compactHeader open={addMenu} title={t('resources.add')} onClose={()=>setAddMenu(false)} actions={[
      {key:'file',label:t('resources.upload'),description:t('resources.uploadHint'),icon:<span className="material-symbols-outlined">upload_file</span>,onSelect:()=>fileInput.current?.click()},
      {key:'link',label:t('resources.addLink'),description:t('resources.linkHint'),icon:<span className="material-symbols-outlined">add_link</span>,onSelect:()=>add('link')},
      ...(!taskId?[{key:'folder',label:t('resources.addFolder'),description:t('resources.projectHint'),disabled:path.length>=2,icon:<span className="material-symbols-outlined">create_new_folder</span>,onSelect:()=>add('folder')}]:[]),
    ]}/>
    <ActionSheet open={!!selected} title={selected?.name||''} onClose={()=>setSelected(null)} actions={selected?[
      {key:'open',label:t(selected.kind==='folder'?'resources.openFolder':'resources.open'),icon:<span className="material-symbols-outlined">{selected.kind==='folder'?'folder_open':'open_in_new'}</span>,onSelect:()=>{void open(selected);}},
      ...(space?.writable&&selected.can_delete?[{key:'delete',label:t('resources.delete'),danger:true,description:selected.kind==='folder'?t('resources.folderNotEmpty'):undefined,icon:<span className="material-symbols-outlined">delete_outline</span>,disabled:selected.kind==='folder'&&space.items.some(item=>item.parent_id===selected.id),onSelect:()=>{setError('');setDeleting(selected);}}]:[]),
    ]:[]}/>
    <ConfirmDialog open={!!adding} title={t(adding==='folder'?'resources.addFolder':'resources.addLink')} description="" busy={busy} confirmDisabled={!name.trim()||(adding==='link'&&!/^https?:\/\//i.test(url.trim()))} onClose={()=>setAdding(null)} onConfirm={()=>void change({action:'add',kind:adding,parent_id:parent,name,url})}><div className="resource-form"><label>{t('research.name')}<input autoFocus maxLength={180} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label>{adding==='link'&&<label>{t('resources.link')}<input type="url" inputMode="url" placeholder="https://" maxLength={2048} value={url} onChange={event=>setUrl(event.target.value)} disabled={busy}/></label>}{error&&<p role="alert" className="resource-error">{error}</p>}</div></ConfirmDialog>
    <ConfirmDialog open={!!deleting} title={t('resources.delete')} description={deleting?.name||''} danger busy={busy} onClose={()=>setDeleting(null)} onConfirm={()=>void change({action:'delete',id:deleting?.id})}>{error&&<p role="alert" className="resource-error">{error}</p>}</ConfirmDialog>
  </SideDrawer>;
}
