import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {StickerSeriesDTO} from '../lib/stickerSeries';
import {InputDialog} from './InputDialog';
import {StickerImage} from './StickerImage';
export function StickerPackReviews(){
  const {t}=useI18n();const [rows,setRows]=useState<StickerSeriesDTO[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reject,setReject]=useState<number|null>(null),[note,setNote]=useState('');
  const load=()=>api.getStickerPackReviews().then(rows=>{setRows(rows);setError('')}).catch(cause=>setError(cause instanceof Error?cause.message:t('sticker.series.failed')));
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(timer)},[]);
  const review=async(id:number,approved:boolean)=>{if(busy)return;setBusy(true);setError('');try{await api.reviewStickerPack(id,approved,note);setReject(null);setNote('');await load()}catch(cause){setError(cause instanceof Error?cause.message:t('sticker.series.failed'))}finally{setBusy(false)}};
  if(!rows.length&&!error)return null;
  return <section className="sticker-pack-reviews"><h3>{t('sticker.review.title')} · {rows.length}</h3>{error?<p role="alert">{error}</p>:null}{rows.map(row=><article key={row.series_id}><header><strong>{row.name}</strong><small>{row.owner?.name} · {t(row.pending_snapshot?.action==='delete'?'sticker.review.delete':'sticker.review.publish')}</small><button disabled={busy} onClick={()=>void review(row.series_id,true)}>{t('sticker.review.approve')}</button><button disabled={busy} onClick={()=>{setNote('');setReject(row.series_id)}}>{t('sticker.review.reject')}</button></header><div className="sticker-review-images">{row.assets.map(asset=><StickerImage key={asset.sticker_asset_id} src={asset.uri}/>)}</div></article>)}<InputDialog open={reject!==null} title={t('sticker.review.reject')} description={t('sticker.review.note')} value={note} onChange={setNote} maxLength={300} busy={busy} confirmDisabled={!note.trim()} onClose={()=>setReject(null)} onConfirm={()=>{if(reject!==null)void review(reject,false)}}/></section>;
}
