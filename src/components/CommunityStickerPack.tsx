import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {StickerAssetDTO} from '../types';
import {StickerImage} from './StickerImage';
export function CommunityStickerPack({id,busy,onSend,onCollected}:{id:number;busy:boolean;onSend:(asset:StickerAssetDTO)=>void|Promise<void>;onCollected?:()=>void}){
  const {t}=useI18n();const [assets,setAssets]=useState<StickerAssetDTO[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;setLoading(true);setError('');void api.getStickerPack(id).then(pack=>{if(active)setAssets(pack.assets)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:t('sticker.series.failed'))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id]);
  return <div className="community-sticker-pack">{loading?<p role="status">{t('common.loading')}</p>:error?<p role="alert">{error}</p>:<><button className="sticker-pack-collect" disabled={saving||busy} onClick={()=>{setSaving(true);void api.collectStickerPack(id).then(()=>onCollected?.()).catch(cause=>setError(cause instanceof Error?cause.message:t('sticker.series.failed'))).finally(()=>setSaving(false))}}>{t(saving?'common.processing':'sticker.series.addHome')}</button><div className="composer-sticker-grid">{assets.map(asset=><button key={asset.sticker_asset_id} className="composer-sticker-item" disabled={busy} onClick={()=>void onSend(asset)}><StickerImage src={asset.uri}/></button>)}</div></>}</div>;
}
