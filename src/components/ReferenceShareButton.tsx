import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../lib/auth';
import {useI18n} from '../lib/language';
import {api} from '../lib/api';
import {showToast} from '../lib/toast';
import {referenceTypes,type MessageReference} from '../lib/messageReferences';
import type {ChatDTO} from '../types';
import {ChatTargetPicker} from './ChatTargetPicker';
import {OverlayIconButton} from './OverlayIconButton';
import './SharedReferenceMessage.css';

export function ReferenceShareButton({reference,className=''}:{reference:MessageReference;className?:string}) {
  const {t}=useI18n(),{session}=useAuth();
  const [open,setOpen]=useState(false),[chats,setChats]=useState<ChatDTO[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState<number|null>(null);
  const keys=useRef(new Map<number,string>()),running=useRef(false);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setLoading(true);
    api.getChats(controller.signal).then(value=>{if(!controller.signal.aborted)setChats(value);}).catch(error=>{if(!controller.signal.aborted)showToast(error instanceof Error?error.message:t('square.shareLoadFailed'),'error');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[open]);
  const send=async(ids:number[])=>{
    const id=ids[0];if(!id||running.current)return;
    running.current=true;setBusy(id);
    if(!keys.current.has(id))keys.current.set(id,crypto.randomUUID());
    try{await api.sendMessage(id,referenceTypes[reference.kind],JSON.stringify(reference),undefined,keys.current.get(id));setOpen(false);showToast(t('square.sharedTo',{chat:chats.find(chat=>chat.chat_id===id)?.title||t('nav.chats')}));keys.current.clear();}
    catch(error){showToast(error instanceof Error?error.message:t('square.shareFailed'),'error');}
    finally{running.current=false;setBusy(null);}
  };
  return <>
    <OverlayIconButton icon="share" className={`reference-share-button ${className}`} aria-label={t('references.share')}
      onClick={event=>{event.stopPropagation();setChats([]);setOpen(true);}} />
    <ChatTargetPicker open={open} title={t('square.shareToChat')} targets={chats.map(chat=>{const peer=chat.members.find(member=>member.user_id!==session?.user.user_id)||chat.members[0];return {id:chat.chat_id,title:chat.title||peer?.name||t('nav.chats'),preview:chat.last_message?.content||'',avatarUri:chat.group?undefined:peer?.avatar_uri,groupMembers:chat.group?chat.members.map(member=>({name:member.name,uri:member.avatar_uri})):undefined};})} loading={loading} busy={busy!==null} busyTargetId={busy} emptyTitle={t('square.noChatsToShare')} onClose={()=>{if(!running.current)setOpen(false);}} onSubmit={send}/>
  </>;
}
