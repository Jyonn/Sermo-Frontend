import { useEffect, useId, useRef, useState } from "react";
import { api } from "../lib/api";
import { CHAT_SYNC_EVENT, type ChatSyncEventDetail } from "../lib/chatSync";
import { GROUP_COPY_EVENT, GROUP_COPY_REMOVED, copySuggestionHint, orderCopySuggestions, type CopySuggestion } from "../lib/groupCopy";
import { useI18n } from "../lib/language";
import { copyText } from "../lib/presentation";
import { showToast } from "../lib/toast";

export function reportGroupCopies(chatId: number, userId: number, ids: number[]) {
  const messageIds = [...new Set(ids)].filter(id=>Number.isSafeInteger(id) && id>0).slice(0,50);
  if (!messageIds.length) return;
  window.dispatchEvent(new CustomEvent(GROUP_COPY_EVENT,{detail:{chatId,userId,ids:messageIds}}));
  // Clipboard success must not depend on analytics delivery; reporting is idempotent.
  void api.recordMessageCopies(chatId,messageIds).catch(()=>undefined);
}

export function GroupCopyShelf({chatId,userId}:{chatId:number;userId:number}) {
  const { t } = useI18n();
  const [items,setItems] = useState<CopySuggestion[]>([]);
  const [open,setOpen] = useState(false);
  const [hint,setHint] = useState(false);
  const [busy,setBusy] = useState(false);
  const [now,setNow] = useState(Date.now());
  const [panelHeight,setPanelHeight] = useState(400);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  useEffect(()=>{
    const scroller=root.current?.closest('.chat-detail-scene')?.querySelector('.message-scroll');
    if(!scroller)return;
    const update=()=>setPanelHeight(Math.max(80,Math.min(470,scroller.clientHeight-36)));
    const observer=new ResizeObserver(update);
    observer.observe(scroller);update();
    return ()=>observer.disconnect();
  },[items.length]);
  useEffect(()=>{
    const controller = new AbortController();
    let hintTimer: number | undefined;
    const copiedDuringLoad = new Set<number>();
    const removedDuringLoad = new Set<number>();
    const markCopied = (event:Event)=>{
      const detail=(event as CustomEvent<{chatId:number;userId:number;ids:number[]}>).detail;
      if(detail?.chatId!==chatId || detail.userId!==userId)return;
      detail.ids.forEach(id=>copiedDuringLoad.add(id));
      setItems(current=>current.map(item=>detail.ids.includes(item.message_id)?{...item,copied:true}:item));
      setHint(false);
    };
    const remove = (ids:number[])=>{
      ids.forEach(id=>removedDuringLoad.add(id));
      setItems(current=>current.filter(item=>!ids.includes(item.message_id)));
    };
    const sync=(event:Event)=>remove(((event as CustomEvent<ChatSyncEventDetail>).detail?.removed??[]).filter(item=>item.chatId===chatId).map(item=>item.messageId));
    const removed=(event:Event)=>{
      const detail=(event as CustomEvent<{chatId:number;ids:number[]}>).detail;
      if(detail?.chatId===chatId)remove(detail.ids);
    };
    window.addEventListener(GROUP_COPY_EVENT,markCopied);
    window.addEventListener(CHAT_SYNC_EVENT,sync);
    window.addEventListener(GROUP_COPY_REMOVED,removed);
    void api.getCopySuggestions(chatId,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      const snapshot=result.items.filter(item=>!removedDuringLoad.has(item.message_id)).map(item=>({...item,copied:item.copied || copiedDuringLoad.has(item.message_id)}));
      setItems(snapshot);
      if (!snapshot.length) return;
      const key=`frienden:group-copy:${userId}:${chatId}`;
      const date=new Date();
      const day=`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
      try {
        const previous=JSON.parse(localStorage.getItem(key) || "null");
        const highlight=copySuggestionHint(snapshot,previous,day);
        localStorage.setItem(key,JSON.stringify({ids:snapshot.map(item=>item.message_id),day:highlight?day:previous?.day}));
        setHint(highlight);
        if(highlight)hintTimer=window.setTimeout(()=>setHint(false),8000);
      } catch { /* Storage may be unavailable in private browsing. Keep the shelf quiet. */ }
    }).catch(()=>undefined);
    const expiry=window.setInterval(()=>setNow(Date.now()),30000);
    return ()=>{
      controller.abort();window.clearTimeout(hintTimer);window.clearInterval(expiry);
      window.removeEventListener(GROUP_COPY_EVENT,markCopied);
      window.removeEventListener(CHAT_SYNC_EVENT,sync);
      window.removeEventListener(GROUP_COPY_REMOVED,removed);
    };
  },[chatId,userId]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !root.current?.contains(event.target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const visible=orderCopySuggestions(items,now);
  if(!visible.length)return null;
  return <div className={`group-copy-shelf${hint?' has-hint':''}`} ref={root}>
    <button ref={trigger} type="button" className="group-copy-bookmark" aria-label={t('copyShelf.title')} aria-expanded={open} aria-controls={panelId} onClick={()=>{setOpen(value=>!value);setHint(false);}}><span className="material-symbols-outlined" aria-hidden="true">content_copy</span></button>
    {hint && !open ? <span className="group-copy-hint" role="status">{t('copyShelf.popular')}</span>:null}
    {open ? <section className="group-copy-panel" style={{maxHeight:panelHeight}} id={panelId} aria-label={t('copyShelf.title')}>
      <header><div><span className="group-copy-eyebrow">{t('copyShelf.recent')}</span><h3>{t('copyShelf.title')}</h3></div><button type="button" aria-label={t('common.close')} onClick={()=>{setOpen(false);trigger.current?.focus();}}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
      <div className="group-copy-items">{visible.map(item=><button type="button" key={item.message_id} disabled={busy} className={`group-copy-item${item.copied?' is-copied':''}`} onClick={async()=>{
        if(busy)return;setBusy(true);
        try {
          if(!await copyText(item.content))throw new Error();
          reportGroupCopies(chatId,userId,[item.message_id]);
          showToast(t('message.batchCopied',{count:1}));
        } catch {showToast(t('common.copyFailed'),'error');}
        finally {setBusy(false);}
      }}><span className="group-copy-author">{item.author}<span className="material-symbols-outlined" aria-hidden="true">{item.copied?'check':'content_copy'}</span></span><span className="group-copy-text">{item.content}</span><small>{t(item.copied?'copyShelf.copied':'copyShelf.tap')}</small></button>)}</div>
    </section>:null}
  </div>;
}
