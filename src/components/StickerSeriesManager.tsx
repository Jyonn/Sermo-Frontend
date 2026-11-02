import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {StickerImage} from './StickerImage';
import {InputDialog} from './InputDialog';
import {ConfirmDialog} from './ConfirmDialog';
import type {StickerDTO} from '../types';
import './StickerSeriesManager.css';

import {validStickerSeriesName,type StickerSeriesDTO} from '../lib/stickerSeries';
import {addStickerFile} from '../lib/stickers';
type Series=StickerSeriesDTO;
export function StickerSeriesManager({revision,onAdd,onChanged}:{revision:unknown;onAdd:()=>void;onChanged:()=>void}) {
  const {t}=useI18n();
  const [series,setSeries]=useState<Series[]>([]),[filter,setFilter]=useState<number|undefined>(),[items,setItems]=useState<StickerDTO[]>([]);
  const [selected,setSelected]=useState<number[]>([]),[target,setTarget]=useState(''),[hasMore,setHasMore]=useState(false),[offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState<number|null|false>(false),[name,setName]=useState('');
  const [deleting,setDeleting]=useState(false);
  const request=useRef(0),upload=useRef<HTMLInputElement>(null);
  const current=series.find(row=>row.series_id===filter),locked=current?.status==='pending';
  const selectedItems=items.filter(row=>selected.includes(row.sticker_id));
  const canAssign=selectedItems.length>0&&selectedItems.every(row=>row.is_uploaded);
  const load=async(append=false)=>{const id=++request.current;setLoading(true);setError('');try{
    const [page,groups]=await Promise.all([api.getStickers(append?offset:0,60,undefined,filter),api.getStickerSeries()]);
    if(id!==request.current)return;
    setItems(current=>append?[...current,...page.items.filter(row=>!current.some(old=>old.sticker_id===row.sticker_id))]:page.items);
    setSeries(groups);setOffset(page.next_offset);setHasMore(page.has_more);
  }catch(cause){if(id===request.current)setError(cause instanceof Error?cause.message:t('sticker.series.failed'))}finally{if(id===request.current)setLoading(false)}};
  useEffect(()=>{setSelected([]);void load();return()=>{request.current++}},[filter,revision]);
  const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await action();setSelected([]);await load();onChanged()}catch(cause){await load();onChanged();setError(cause instanceof Error?cause.message:t('sticker.series.failed'))}finally{setBusy(false)}};
  return <div className="sticker-series-manager" aria-busy={loading||busy}>
    <header className="sticker-series-toolbar"><nav aria-label={t('sticker.series.title')}><button className={filter===undefined?'is-active':''} onClick={()=>setFilter(undefined)}>{t('sticker.series.home')}</button><button className={filter===0?'is-active':''} onClick={()=>setFilter(0)}>{t('sticker.series.uploads')}</button>{series.map(group=><button key={group.series_id} className={filter===group.series_id?'is-active':''} onClick={()=>setFilter(group.series_id)}>{group.name}<small>{group.count}</small></button>)}</nav><div><button disabled={busy||loading} aria-label={t('resources.refresh')} onClick={()=>void load()}><span className="material-symbols-outlined">refresh</span></button><button disabled={busy} onClick={()=>{setName('');setEditing(null)}}><span className="material-symbols-outlined">create_new_folder</span>{t('sticker.series.create')}</button><button disabled={busy||locked} onClick={()=>filter?upload.current?.click():onAdd()}><span className="material-symbols-outlined">add_photo_alternate</span>{t('sticker.add')}</button></div></header>
    <input ref={upload} hidden type="file" accept="image/*" multiple onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';if(filter&&files.length)void run(async()=>{for(const file of files)await addStickerFile(file,undefined,filter)})}}/>

    {current?<div className="sticker-series-tools">
      <span className="sticker-series-status">{t(`sticker.series.status.${current.status}`)}</span>
      <button disabled={busy||locked} onClick={()=>{setName(current.name);setEditing(current.series_id)}}>{t('resources.rename')}</button>
      <button disabled={busy||locked} onClick={()=>{setTarget(String(filter));setFilter(0)}}>{t('sticker.series.chooseUploads')}</button>
      <button disabled={busy||locked||!current.count||!current.has_changes} onClick={()=>void run(()=>api.submitStickerSeries(current.series_id))}>{t('sticker.series.submit')}</button>
      <button disabled={busy||locked} onClick={()=>void run(async()=>{await api.deleteStickerSeries(current.series_id);if(!current.published)setFilter(0)})}>{t(current.published?'sticker.series.requestDelete':'sticker.series.remove')}</button>
      <p>{current.review_note||t(current.published?'sticker.series.publishedHint':'sticker.series.draftHint')}</p>
    </div>:<p className="sticker-series-intro">{t(filter===0?'sticker.series.uploadsHint':'sticker.series.homeHint')}</p>}
    {error?<p role="alert" className="error">{error}<button onClick={()=>void load()}>{t('common.retry')}</button></p>:null}
    <div className="sticker-series-grid">{items.map(row=><button type="button" disabled={busy} aria-label={t('sticker.series.select')} aria-pressed={selected.includes(row.sticker_id)} key={row.sticker_id} className={selected.includes(row.sticker_id)?'is-selected':''} onClick={()=>setSelected(current=>current.includes(row.sticker_id)?current.filter(id=>id!==row.sticker_id):current.length<200?[...current,row.sticker_id]:current)}><StickerImage src={row.uri}/><span className="sticker-series-check material-symbols-outlined">{selected.includes(row.sticker_id)?'check_circle':'radio_button_unchecked'}</span></button>)}</div>
    {!items.length&&!loading?<div className="sticker-series-empty"><span className="material-symbols-outlined">collections</span><p>{t('sticker.series.empty')}</p></div>:null}
    {loading?<p role="status">{t('common.loading')}</p>:hasMore?<button className="sticker-series-more" onClick={()=>void load(true)}>{t('sticker.series.more')}</button>:null}
    <footer className="sticker-series-selection">
      <span>{t('sticker.series.selected',{count:selected.length})}</span>
      <button disabled={!items.length||busy} onClick={()=>setSelected(selected.length===items.length?[]:items.slice(0,200).map(row=>row.sticker_id))}>{t('sticker.series.selectAll')}</button>
      <select aria-label={t('sticker.series.move')} value={target} onChange={e=>setTarget(e.target.value)}><option value="">{t('sticker.series.move')}</option>{series.filter(group=>group.status!=='pending').map(group=><option key={group.series_id} value={group.series_id}>{group.name}</option>)}</select>
      <button className="is-primary" disabled={!canAssign||target===''||busy} onClick={()=>void run(()=>api.assignStickerSeries(selected,Number(target)))}>{t('sticker.series.apply')}</button>
      {filter!==undefined?<button disabled={!selected.length||busy} onClick={()=>void run(async()=>{for(const row of selectedItems)await api.collectStickerAsset(row.sticker_asset_id)})}>{t('sticker.series.addHome')}</button>:null}
      <button disabled={!selected.length||busy||locked} onClick={()=>setDeleting(true)}>{t(filter?'sticker.series.removeSelected':'sticker.series.removeHome')}</button>
    </footer>
    <ConfirmDialog open={deleting} title={t(filter?'sticker.series.removeSelected':'sticker.series.removeHome')} description={t(filter?'sticker.series.draftHint':'sticker.deleteConfirmHint')} danger busy={busy} onClose={()=>setDeleting(false)} onConfirm={()=>void run(async()=>{for(const row of selectedItems){if(filter)await api.removeStickerSeriesAsset(filter,row.sticker_asset_id);else await api.deleteSticker(row.sticker_id)}setDeleting(false)})}/>
    <InputDialog open={editing!==false} title={t(editing?'sticker.series.rename':'sticker.series.create')} description={t('sticker.series.nameHint')} value={name} onChange={setName} maxLength={10} confirmDisabled={!validStickerSeriesName(name)} busy={busy} onClose={()=>setEditing(false)} onConfirm={()=>void run(async()=>{const row=await api.saveStickerSeries(name.trim(),editing||undefined);setEditing(false);setFilter(row.series_id)})}/>
  </div>;
}
