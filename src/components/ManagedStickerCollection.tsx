import {useEffect, useState} from 'react';
import {useI18n} from '../lib/language';
import {loadResourceCollection, useResourceCollection} from '../lib/managedResources';
import type {StickerAssetDTO} from '../types';
import {StickerImage} from './StickerImage';
import {managedExpressionSrc} from '../lib/explorerExpressions';

export function ManagedStickerCollection({slug,busy,onSend}:{slug:string;busy:boolean;onSend:(value:StickerAssetDTO)=>void|Promise<void>}) {
  const {t,language}=useI18n();
  const collection=useResourceCollection(slug);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;setFailed(false);void loadResourceCollection(slug).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[slug]);
  if(!collection)return <div className="composer-sticker-empty" role="status"><span className="material-symbols-outlined">{failed?'cloud_off':'progress_activity'}</span><strong>{t(failed?'resources.loadFailed':'common.loading')}</strong>{failed?<button type="button" onClick={()=>{setFailed(false);void loadResourceCollection(slug,true).catch(()=>setFailed(true))}}>{t('common.retry')}</button>:null}</div>;
  return <div className="composer-sticker-grid managed-sticker-grid">{collection.assets.filter(asset=>asset.sticker_asset_id).map(asset=><button className="composer-sticker-item" type="button" disabled={busy} key={asset.resource_id} aria-label={language==='en'?asset.title_en||asset.title:asset.title} title={language==='en'?asset.title_en||asset.title:asset.title} onClick={()=>void onSend(asset)}><StickerImage src={slug==='haibara-v2'?managedExpressionSrc(asset):asset.thumbnail_uri}/></button>)}{!collection.assets.length?<p>{t('resources.empty')}</p>:null}</div>;
}
