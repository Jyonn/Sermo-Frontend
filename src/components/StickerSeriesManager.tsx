import {useEffect,useRef,useState} from 'react';
import {api,ApiError} from '../lib/api';
import {useI18n,type TranslationKey} from '../lib/language';
import {addStickerFile} from '../lib/stickers';
import {validStickerSeriesName,type StickerSeriesDTO} from '../lib/stickerSeries';
import type {StickerDTO} from '../types';
import {StickerImage} from './StickerImage';
import {InputDialog} from './InputDialog';
import {ConfirmDialog} from './ConfirmDialog';
import {BottomSheet} from './BottomSheet';
import './StickerSeriesManager.css';

type Scope=number|undefined;
export function StickerSeriesManager({revision,onAdd,onChanged,initialSeriesId}:{revision:unknown;onAdd:()=>void;onChanged:()=>void;initialSeriesId?:number}) {
  const {t}=useI18n();
  const [groups,setGroups]=useState<StickerSeriesDTO[]>([]),[scope,setScope]=useState<Scope>(initialSeriesId);
  const [items,setItems]=useState<StickerDTO[]>([]),[selected,setSelected]=useState<number[]>([]);
  const [mobileDetail,setMobileDetail]=useState(initialSeriesId!==undefined),[selecting,setSelecting]=useState(false),[choosing,setChoosing]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[more,setMore]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState<number|null|false>(false),[name,setName]=useState(''),[confirm,setConfirm]=useState<'items'|'collection'|null>(null),[organizing,setOrganizing]=useState(false);
  const [query,setQuery]=useState('');
  const [menu,setMenu]=useState<'add'|'collection'|null>(null);
  const upload=useRef<HTMLInputElement>(null),serial=useRef(0),offset=useRef(0),loadingRef=useRef(false),busyRef=useRef(false);
  const current=groups.find(row=>row.series_id===scope),locked=current?.status==='pending';
  const selectedItems=items.filter(row=>selected.includes(row.sticker_id));
  const title=choosing?t('sticker.workspace.chooseTitle'):current?.name??t(scope===0?'sticker.series.uploads':'sticker.series.home');
  const shownGroups=groups.filter(group=>group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const eligible=selectedItems.length>0&&selectedItems.every(row=>row.is_uploaded&&!row.series_id);
  const load=async(append=false)=>{
    if(append&&loadingRef.current)return;
    const id=++serial.current;loadingRef.current=true;setLoading(true);setError('');
    try{
      const [page,list]=await Promise.all([api.getStickers(append?offset.current:0,60,undefined,choosing?0:scope),api.getStickerSeries()]);
      if(id!==serial.current)return;
      setItems(old=>append?[...old,...page.items.filter(row=>!old.some(item=>item.sticker_id===row.sticker_id))]:page.items);
      setGroups(list);offset.current=page.next_offset;setMore(page.has_more);
    }catch(cause){if(id===serial.current)setError(cause instanceof Error?cause.message:t('sticker.series.failed'))}
    finally{if(id===serial.current){loadingRef.current=false;setLoading(false)}}
  };
  useEffect(()=>{setSelected([]);setSelecting(false);setItems([]);void load();return()=>{serial.current++;loadingRef.current=false}},[scope,choosing,revision]);
  const go=(value:Scope)=>{setScope(value);setChoosing(false);setMobileDetail(true);setSelected([]);setSelecting(false)};
  const run=async(action:()=>Promise<unknown>)=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{await action();setSelected([]);setSelecting(false);await load();onChanged()}
    catch(cause){await load();onChanged();setError(cause instanceof ApiError&&cause.identifier==='STICKER@SERIES_CONFLICT'?t('sticker.workspace.conflict'):cause instanceof Error?cause.message:t('sticker.series.failed'))}
    finally{busyRef.current=false;setBusy(false)}
  };
  const toggle=(row:StickerDTO)=>{if(busy||choosing&&row.series_id!==null&&row.series_id!==undefined)return;setSelecting(true);setSelected(old=>old.includes(row.sticker_id)?old.filter(id=>id!==row.sticker_id):old.length<200?[...old,row.sticker_id]:old)};
  const uploadFiles=(files:File[])=>{if(!files.length)return;void run(async()=>{for(const file of files)await addStickerFile(file,undefined,scope||undefined)})};
  const move=(id:number)=>void run(async()=>{await api.assignStickerSeries(selected,id);setOrganizing(false)});
  const cover=(group:StickerSeriesDTO)=><span className="ss-cover" aria-hidden="true">{group.assets.slice(0,4).map(asset=><StickerImage key={asset.sticker_asset_id} src={asset.uri}/>)}{!group.assets.length?<span className="material-symbols-outlined">collections</span>:null}</span>;
  return <div className={`sticker-studio${mobileDetail?' is-detail':''}${choosing?' is-choosing':''}`} aria-busy={busy}>
    <aside className="ss-library">
      <header><div><small>{t('sticker.workspace.libraryEyebrow')}</small><h2>{t('sticker.workspace.library')}</h2></div><button className="ss-icon" aria-label={t('sticker.series.create')} title={t('sticker.series.create')} disabled={busy} onClick={()=>{setName('');setEditing(null)}}><span className="material-symbols-outlined">add</span></button></header>
      <nav aria-label={t('sticker.workspace.library')} className="ss-views">
        {[{id:undefined,icon:'grid_view',label:'sticker.series.home'},{id:0,icon:'cloud_upload',label:'sticker.series.uploads'}].map(view=><button key={view.label} className={scope===view.id?'is-current':''} disabled={busy} onClick={()=>go(view.id)}><span className="material-symbols-outlined">{view.icon}</span><span>{t(view.label as TranslationKey)}</span><span className="material-symbols-outlined ss-chevron">chevron_right</span></button>)}
      </nav>
      <div className="ss-collection-heading"><h3>{t('sticker.workspace.collections')}</h3><small>{groups.length}</small></div>
      {groups.length>5?<label className="ss-search"><span className="material-symbols-outlined">search</span><input value={query} onChange={event=>setQuery(event.target.value)} aria-label={t('sticker.workspace.find')} placeholder={t('sticker.workspace.find')}/></label>:null}
      <nav className="ss-collection-list" aria-label={t('sticker.workspace.collections')}>{shownGroups.map(group=><button key={group.series_id} disabled={busy} className={scope===group.series_id?'is-current':''} onClick={()=>go(group.series_id)}>{cover(group)}<span><strong>{group.name}</strong><small>{t('sticker.workspace.itemCount',{count:group.count})}<i/> {t(`sticker.series.status.${group.status}`)}</small></span><span className="material-symbols-outlined ss-chevron">chevron_right</span></button>)}</nav>
      <button className="ss-new-collection" disabled={busy} onClick={()=>{setName('');setEditing(null)}}><span className="material-symbols-outlined">create_new_folder</span>{t('sticker.series.create')}</button>
    </aside>
    <section className="ss-editor">
      <header className="ss-editor-heading">
        <div className="ss-heading-copy"><button className="ss-icon ss-mobile-back" aria-label={t('common.back')} onClick={()=>{setMobileDetail(false);setSelected([]);setSelecting(false)}}><span className="material-symbols-outlined">arrow_back</span></button><div><h2>{title}</h2><p>{choosing?t('sticker.workspace.chooseHint'):t('sticker.workspace.itemCount',{count:current?.count??items.length})}</p></div></div>
        <div className="ss-heading-actions">
          {choosing?<button className="ss-text" disabled={busy} onClick={()=>setChoosing(false)}>{t('common.cancel')}</button>:<>
            <button className="ss-text" disabled={busy||!items.length} onClick={()=>{setSelecting(value=>!value);setSelected([])}}>{t(selecting?'common.cancel':'common.manage')}</button>
            <button className="ss-primary" disabled={busy||locked} onClick={()=>setMenu('add')}><span className="material-symbols-outlined">add</span>{t('sticker.add')}</button>
            {current?<button className="ss-icon" disabled={busy} aria-label={t('sticker.workspace.collectionOptions')} onClick={()=>setMenu('collection')}><span className="material-symbols-outlined">more_horiz</span></button>:<button className="ss-icon" aria-label={t('resources.refresh')} disabled={busy||loading} onClick={()=>void load()}><span className="material-symbols-outlined">refresh</span></button>}

          </>}
        </div>
      </header>
      {current&&!choosing?<div className={`ss-review-strip is-${current.status}`}><span className="material-symbols-outlined">{locked?'schedule':current.published?'verified':'edit_note'}</span><div><strong>{t(`sticker.series.status.${current.status}`)}</strong><p>{current.review_note||t(locked?'sticker.workspace.pendingHint':current.published?'sticker.workspace.liveHint':'sticker.workspace.draftHint')}</p></div><button className="ss-text" disabled={busy||locked||!current.count||!current.has_changes} onClick={()=>void run(()=>api.submitStickerSeries(current.series_id))}>{t('sticker.series.submit')}<span className="material-symbols-outlined">arrow_upward</span></button></div>:null}
      {error?<div className="ss-error" role="alert">{error}<button className="ss-text" onClick={()=>void load()}>{t('common.retry')}</button></div>:null}
      <div className={`ss-assets${selecting||choosing?' is-selecting':''}`}>
        {items.map(row=>{const reserved=choosing&&Boolean(row.series_id);return <button key={row.sticker_id} disabled={busy||reserved} aria-pressed={selected.includes(row.sticker_id)} aria-label={t('sticker.series.select')} className={`ss-asset${selected.includes(row.sticker_id)?' is-selected':''}${reserved?' is-reserved':''}`} onClick={()=>toggle(row)}><span className="ss-asset-image"><StickerImage src={row.uri}/><span className="ss-check material-symbols-outlined">{selected.includes(row.sticker_id)?'check_circle':'radio_button_unchecked'}</span></span>{scope===0||choosing?<small>{row.series_id?groups.find(group=>group.series_id===row.series_id)?.name??t('sticker.workspace.assigned'):t('sticker.workspace.unassigned')}</small>:null}</button>})}
      </div>
      {loading?<div className="ss-loading" role="status"><span className="composer-sticker-page-loading"/>{t('common.loading')}</div>:!items.length?<div className="ss-empty"><span className="material-symbols-outlined">{current?'photo_library':'photo_stack'}</span><h3>{t(current?'sticker.workspace.emptyCollection':'sticker.workspace.emptyLibrary')}</h3><p>{t(current?'sticker.workspace.emptyCollectionHint':'sticker.series.homeHint')}</p>{current?<div><button className="ss-primary" disabled={locked||busy} onClick={()=>upload.current?.click()}>{t('sticker.workspace.upload')}</button><button className="ss-text" disabled={locked||busy} onClick={()=>setChoosing(true)}>{t('sticker.series.chooseUploads')}</button></div>:null}</div>:more?<button className="ss-load-more ss-text" disabled={loading} onClick={()=>void load(true)}>{t('sticker.series.more')}</button>:null}
      {selecting||choosing?<footer className="ss-selection-bar"><div><strong>{t('sticker.series.selected',{count:selected.length})}</strong><button className="ss-text" disabled={busy} onClick={()=>setSelected(items.filter(row=>!choosing||!row.series_id).slice(0,200).map(row=>row.sticker_id))}>{t('sticker.series.selectAll')}</button></div><div>
        {choosing?<button className="ss-primary" disabled={busy||!selected.length||locked} onClick={()=>void run(async()=>{if(scope)await api.assignStickerSeries(selected,scope);setChoosing(false)})}>{t('sticker.workspace.addSelected')}</button>:<>
          {!current?<button className="ss-primary" disabled={busy||!eligible} onClick={()=>setOrganizing(true)}>{t('sticker.workspace.organize')}</button>:null}
          {scope!==undefined?<button className="ss-text" disabled={busy||!selected.length} onClick={()=>void run(async()=>{for(const row of selectedItems)await api.collectStickerAsset(row.sticker_asset_id)})}>{t('sticker.series.addHome')}</button>:null}
          <button className="ss-text is-danger" disabled={busy||!selected.length||locked} onClick={()=>setConfirm('items')}>{t(current?'sticker.series.removeSelected':'sticker.series.removeHome')}</button>
        </>}
      </div></footer>:null}
    </section>
    <input ref={upload} hidden type="file" accept="image/*" multiple onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';uploadFiles(files)}}/>
    <BottomSheet open={menu!==null} title={t(menu==='add'?'sticker.add':'sticker.workspace.collectionOptions')} onClose={()=>setMenu(null)}><div className="ss-menu-options">{menu==='add'?<>
      <button disabled={busy||locked} onClick={()=>{setMenu(null);if(scope)upload.current?.click();else onAdd()}}><span className="material-symbols-outlined">upload</span>{t('sticker.workspace.upload')}</button>
      {current?<button disabled={busy||locked} onClick={()=>{setMenu(null);setChoosing(true);setSelected([])}}><span className="material-symbols-outlined">photo_library</span>{t('sticker.series.chooseUploads')}</button>:null}
    </>:current?<>
      <button disabled={busy||locked} onClick={()=>{setMenu(null);setName(current.name);setEditing(current.series_id)}}><span className="material-symbols-outlined">edit</span>{t('resources.rename')}</button>
      <button className="is-danger" disabled={busy||locked} onClick={()=>{setMenu(null);setConfirm('collection')}}><span className="material-symbols-outlined">delete</span>{t(current.published?'sticker.series.requestDelete':'sticker.series.remove')}</button>
    </>:null}</div></BottomSheet>
    <BottomSheet open={organizing} title={t('sticker.workspace.organize')} onClose={()=>{if(!busy)setOrganizing(false)}}><div className="ss-destination-list">{groups.filter(group=>group.status!=='pending').map(group=><button key={group.series_id} disabled={busy} onClick={()=>move(group.series_id)}>{cover(group)}<span><strong>{group.name}</strong><small>{t('sticker.workspace.itemCount',{count:group.count})}</small></span><span className="material-symbols-outlined">chevron_right</span></button>)}{!groups.some(group=>group.status!=='pending')?<p>{t('sticker.workspace.createFirst')}</p>:null}</div></BottomSheet>
    <InputDialog open={editing!==false} title={t(editing?'sticker.series.rename':'sticker.series.create')} description={t('sticker.series.nameHint')} value={name} onChange={setName} maxLength={10} confirmDisabled={!validStickerSeriesName(name)} busy={busy} onClose={()=>{if(!busy)setEditing(false)}} onConfirm={()=>void run(async()=>{const row=await api.saveStickerSeries(name.trim(),editing||undefined);setEditing(false);go(row.series_id)})}/>
    <ConfirmDialog open={confirm!==null} title={t(confirm==='collection'?(current?.published?'sticker.series.requestDelete':'sticker.series.remove'):current?'sticker.series.removeSelected':'sticker.series.removeHome')} description={t(current?.published?'sticker.workspace.liveHint':'sticker.workspace.removeHint')} danger busy={busy} onClose={()=>{if(!busy)setConfirm(null)}} onConfirm={()=>void run(async()=>{if(confirm==='collection'&&current){await api.deleteStickerSeries(current.series_id);if(!current.published)go(undefined)}else{for(const row of selectedItems){if(current)await api.removeStickerSeriesAsset(current.series_id,row.sticker_asset_id);else await api.deleteSticker(row.sticker_id)}}setConfirm(null)})}/>
  </div>;
}
