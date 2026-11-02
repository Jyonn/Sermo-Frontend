import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {StickerDTO} from '../types';
import {StickerPickerItem} from './StickerPickerItem';

export function PersonalStickerCollection({id,busy,onSend,onManage}:{id:number;busy:boolean;onSend:(sticker:StickerDTO)=>void|Promise<void>;onManage?:(id?:number)=>void}) {
  const {t}=useI18n();
  const [items,setItems]=useState<StickerDTO[]>([]),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const page=useRef({offset:0,more:true,busy:false,generation:0});
  const load=async(append:boolean)=>{
    const state=page.current;if(state.busy||append&&!state.more)return;
    state.busy=true;setLoading(true);setFailed(false);const generation=state.generation;
    try{const result=await api.getStickers(append?state.offset:0,60,undefined,id);if(page.current.generation!==generation)return;setItems(old=>append?[...old,...result.items.filter(row=>!old.some(item=>item.sticker_id===row.sticker_id))]:result.items);state.offset=result.next_offset;state.more=result.has_more}
    catch{if(page.current.generation===generation)setFailed(true)}
    finally{if(page.current.generation===generation){state.busy=false;setLoading(false)}}
  };
  useEffect(()=>{page.current={offset:0,more:true,busy:false,generation:page.current.generation+1};setItems([]);void load(false);return()=>{page.current.generation++}},[id,retry]);
  return <div className="composer-sticker-grid" onScroll={event=>{const node=event.currentTarget;if(node.scrollHeight-node.scrollTop-node.clientHeight<100)void load(true)}}>
    {onManage?<button className="composer-sticker-add" aria-label={t('sticker.manageTitle')} onClick={()=>onManage(id)}><span className="material-symbols-outlined">tune</span></button>:null}
    {items.map(row=><StickerPickerItem key={row.sticker_id} busy={busy} src={row.uri} description={row.description} onClick={()=>void onSend(row)}/>)}
    {loading?<span className="composer-sticker-page-loading" aria-label={t('common.loading')}/>:failed?<button className="personal-sticker-retry" onClick={()=>setRetry(value=>value+1)}>{t('common.retry')}</button>:!items.length?<p className="personal-sticker-empty">{t('sticker.series.empty')}</p>:null}
  </div>;
}
