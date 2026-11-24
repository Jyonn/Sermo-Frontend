import {useState} from 'react';
import {useI18n} from '../lib/language';
import {api} from '../lib/api';
import {showToast} from '../lib/toast';
import {safeActivityImage} from '../lib/activityPresentation';
import type {ActivityCampaignDTO,RecordShopAlbum as Album} from '../types';
import {ActivityDetails} from './ActivityDetails';
import {ActivityTitle} from './ActivityCampaignCard';
import {RecordShopAlbum,RecordShopDecorationView} from './RecordShopAlbum';

const singers=['jay','leehom','david','jj'] as const;

export function RecordShopActivity({activity,onUpdate}:{activity:ActivityCampaignDTO;onUpdate:(value:ActivityCampaignDTO)=>void}) {
  const {t,language}=useI18n();
  const [pending,setPending]=useState('');
  const [catalogSinger,setCatalogSinger]=useState<(typeof singers)[number]>('jay');
  const [album,setAlbum]=useState<Album|null>(null);
  const info=activity.record_shop;
  if(!info)return null;
  const title=language.startsWith('zh')?activity.title:(activity.title_en||activity.title);
  const catalog=info.albums[catalogSinger]??[];
  const catalogArtist=t(`recordShop.singer.${catalogSinger}`);
  const decoration={artist:catalogSinger,portrait:info.portraits[catalogSinger]};
  const choose=async(singer:string)=>{
    if(pending)return;
    setPending(singer);
    try{onUpdate({...activity,record_shop:await api.recordShopSinger(activity.key,singer)});}
    catch(error){showToast(error instanceof Error?error.message:t('common.retry'),'error');}
    finally{setPending('');}
  };
  return <section className="record-shop-activity">
    <header className="record-shop-heading"><ActivityTitle activity={activity} title={title}/></header>
    <div className="record-shop-progress">
      <span>{t('recordShop.points')}</span>
      <strong>{info.points}<small> / {info.thresholds[1]}</small></strong>
      <progress max={info.thresholds[1]} value={Math.min(info.points,info.thresholds[1])} aria-label={t('recordShop.points')}/>
      <div><span>{t('recordShop.firstChoice',{points:info.thresholds[0]})}</span><span>{t('recordShop.secondChoice',{points:info.thresholds[1]})}</span></div>
    </div>
    <div className="record-shop-singers">{singers.map(singer=>{
      const portrait=safeActivityImage(info.portraits[singer]);
      const status=info.equipped===singer?'equipped':info.singers.includes(singer)?'equip':info.choices?'choose':'locked';
      return <button key={singer} type="button" aria-pressed={status==='equipped'} disabled={!activity.active||!!pending||status==='locked'||status==='equipped'} onClick={()=>void choose(singer)}>
        {portrait?<img src={portrait} alt=""/>:null}
        <strong>{t(`recordShop.singer.${singer}`)}</strong>
        <small>{t(`recordShop.${status}`)}</small>
      </button>;
    })}</div>
    <ActivityDetails rules={<ul className="record-shop-rules">{(['shareRule','listenRule','dedupeRule','selectionRule','discoveryRule'] as const).map(rule=><li key={rule}>{t(`recordShop.${rule}`)}</li>)}</ul>} rewards={<div className="record-shop-catalog">
      <div className="record-shop-catalog-tabs">{singers.map(singer=><button key={singer} type="button" aria-pressed={catalogSinger===singer} onClick={()=>setCatalogSinger(singer)}>{t(`recordShop.singer.${singer}`)}</button>)}</div>
      <article className="record-shop-reward" key={catalogSinger}>
        <h3>{t('recordShop.bubbleTitle',{artist:catalogArtist})}</h3>
        <div className="record-shop-reward-preview">
          <div className="message-bubble-shell self group-start" data-record-shop-artist={catalogSinger}>
            <RecordShopDecorationView decoration={decoration} />
            <div className="message-bubble self group-start record-shop-text-bubble">{t('recordShop.bubblePreviewFirst')}</div>
          </div>
          {catalog.length ? <div className="message-bubble-shell self" data-record-shop-artist={catalogSinger}>
            <RecordShopDecorationView decoration={{...decoration,album:catalog[0]}} />
            <div className="message-bubble self group-end record-shop-text-bubble">{t('recordShop.bubblePreviewNext')}</div>
          </div> : null}
        </div>
        <p>{t('recordShop.bubbleElementsHint')}</p>
      </article>
      {catalog.length ? <h4 className="record-shop-elements-title">{t('recordShop.albumElements')}</h4> : null}
      {catalog.map(row=><button className="record-shop-catalog-entry" type="button" key={row.id} onClick={()=>setAlbum(row)}>
        <img src={safeActivityImage(row.cover)} loading="lazy" alt=""/><span><b>{row.name}</b><small>{row.title}</small></span>
        <small>{t(`recordShop.tier.${row.tier}`)}</small>
      </button>)}
    </div>}/>
    {album?<RecordShopAlbum album={album} onClose={()=>setAlbum(null)}/>:null}
  </section>;
}
