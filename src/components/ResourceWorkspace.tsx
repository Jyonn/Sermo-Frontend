import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {ManagedResourceDTO,ResourceCollectionDTO} from '../types';
import {InputDialog} from './InputDialog';
import {StickerPackReviews} from './StickerPackReviews';
import './ResourceWorkspace.css';

const empty={slug:'',title:'',title_en:'',version:'v1',category:'emoji' as ResourceCollectionDTO['category'],published:false};
export function ResourceWorkspace() {
  const {t,language}=useI18n();
  const [collections,setCollections]=useState<ResourceCollectionDTO[]>([]);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [draft,setDraft]=useState(empty),[creating,setCreating]=useState(false),[query,setQuery]=useState('');
  const [edit,setEdit]=useState<ManagedResourceDTO|null>(null);
  const [editTitle,setEditTitle]=useState('');
  useEffect(()=>setEditTitle(edit?.title??''),[edit]);
  const upload=useRef<HTMLInputElement>(null);
  const collection=collections.find(row=>row.slug===selected);
  const load=async()=>{setLoading(true);try{const rows=await api.getPlatformResources();setCollections(rows);setSelected(value=>rows.some(row=>row.slug===value)?value:rows[0]?.slug??'');setError('')}catch(cause){setError(cause instanceof Error?cause.message:t('resources.loadFailed'))}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const run=async(action:()=>Promise<unknown>)=>{if(busy)return false;setBusy(true);setError('');try{await action();await load();return true}catch(cause){await load();setError(cause instanceof Error?cause.message:t('resources.failed'));return false}finally{setBusy(false)}};
  const create=(event:FormEvent)=>{event.preventDefault();void run(async()=>{await api.savePlatformCollection(draft);setSelected(draft.slug);setDraft(empty);setCreating(false)})};
  const uploadFiles=(files:File[])=>void run(async()=>{
    if(!collection)return;
    for(const file of files){
      if(file.size>10*1024*1024)throw new Error(t('resources.maxSize'));
      const slug=`asset-${crypto.randomUUID().replace(/-/g,'')}`;
      await api.uploadPlatformResource(file,collection.slug,slug,file.name.replace(/\.[^.]+$/,''),'');
    }
  });
  return <section className="platform-panel resource-workspace" aria-busy={busy||loading}>
    <StickerPackReviews/>
    <header className="resource-toolbar"><div><h2>{t('management.resources')}</h2><p>{t('resources.managementHint')}</p></div><button type="button" disabled={busy||loading} onClick={()=>void load()}>{t('resources.refresh')}</button><button type="button" disabled={busy} onClick={()=>setCreating(value=>!value)}>{t('resources.newCollection')}</button></header>
    {error?<p className="error" role="alert">{error}</p>:null}
    {creating?<form className="resource-create" onSubmit={create}>
      <label>{t('resources.identifier')}<input required pattern="[a-z0-9][a-z0-9_-]{0,63}" value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value})}/></label>
      <label>{t('resources.name')}<input required maxLength={80} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label>{t('resources.englishName')}<input maxLength={80} value={draft.title_en} onChange={e=>setDraft({...draft,title_en:e.target.value})}/></label>
      <label>{t('resources.version')}<input required pattern="[a-z0-9][a-z0-9_-]{0,31}" value={draft.version} onChange={e=>setDraft({...draft,version:e.target.value})}/></label>
      <label>{t('resources.category')}<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value as typeof draft.category})}>{(['emoji','avatar-frame','background','illustration','activity'] as const).map(kind=><option key={kind} value={kind}>{t(`resources.category.${kind}`)}</option>)}</select></label>
      <button className="platform-primary" type="submit" disabled={busy}>{t('resources.createDraft')}</button>
    </form>:null}
    <nav className="resource-collections" aria-label={t('resources.collections')}>{collections.map(row=><button key={row.slug} type="button" aria-pressed={selected===row.slug} onClick={()=>setSelected(row.slug)}>{language.startsWith('zh')?row.title:row.title_en||row.title}<small>{row.version} · {row.assets.length}</small></button>)}</nav>
    {collection?<><div className="resource-collection-heading"><div><strong>{language.startsWith('zh')?collection.title:collection.title_en||collection.title}</strong><span>{collection.directory??collection.slug} / {collection.version}</span></div><span className={collection.published?'resource-status is-live':'resource-status'}>{t(collection.published?'resources.published':'resources.draft')}</span><button type="button" disabled={busy} onClick={()=>void run(()=>api.savePlatformCollection({...collection,published:!collection.published}))}>{t(collection.published?'resources.unpublish':'resources.publish')}</button><button className="platform-primary" type="button" disabled={busy} onClick={()=>upload.current?.click()}>{t(busy?'common.processing':'resources.upload')}</button><input ref={upload} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';if(files.length)uploadFiles(files)}}/></div>
      <label className="resource-search"><span className="material-symbols-outlined">search</span><input aria-label={t('resources.search')} placeholder={t('resources.search')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="resource-grid">{collection.assets.filter(row=>`${row.title} ${row.title_en} ${row.slug}`.toLowerCase().includes(query.toLowerCase())).map(row=><article className="resource-card" key={row.resource_id}><a href={row.original_uri} target="_blank" rel="noreferrer">{row.mime_type.startsWith('image/')?<img loading="lazy" src={row.thumbnail_uri} alt={row.title}/>:<span className="material-symbols-outlined">{row.mime_type.startsWith('audio/')?'audio_file':'description'}</span>}</a><strong>{language.startsWith('zh')?row.title:row.title_en||row.title}</strong><small>{row.pixel_width} × {row.pixel_height} · {Math.ceil(row.file_size/1024)} KB</small><div><label>{t('resources.order')}<input aria-label={`${row.title} ${t('resources.order')}`} type="number" min={0} max={10000} disabled={busy} defaultValue={row.position} key={row.position} onBlur={event=>{const position=Number(event.target.value);if(Number.isInteger(position)&&position>=0&&position<=10000&&position!==row.position)void run(()=>api.savePlatformResource(row.resource_id,{position}))}}/></label><button type="button" disabled={busy} onClick={()=>setEdit(row)}>{t('resources.rename')}</button><button type="button" disabled={busy} aria-pressed={Boolean(row.enabled)} onClick={()=>void run(()=>api.savePlatformResource(row.resource_id,{enabled:!row.enabled}))}>{t(row.enabled?'resources.disable':'resources.enable')}</button></div></article>)}</div>
      {!collection.assets.length?<div className="platform-empty"><span className="material-symbols-outlined">photo_library</span><strong>{t('resources.empty')}</strong><p>{t('resources.maxSize')}</p></div>:null}
    </>:!loading?<div className="platform-empty"><strong>{t('resources.noCollections')}</strong></div>:<p role="status">{t('common.loading')}</p>}
    <InputDialog open={Boolean(edit)} title={t('resources.rename')} value={editTitle} onChange={setEditTitle} maxLength={80} busy={busy} confirmDisabled={!editTitle.trim()} onClose={()=>{setEdit(null);setEditTitle('')}} onConfirm={()=>{if(edit)void run(()=>api.savePlatformResource(edit.resource_id,{title:editTitle.trim()})).then(ok=>{if(ok){setEdit(null);setEditTitle('')}})}}/>
  </section>;
}
