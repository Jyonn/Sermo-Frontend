import type {ChatMessage} from '../types';
import {systemMessageParts,type SystemMessageContext} from '../lib/systemMessage';
import {useI18n} from '../lib/language';
import type {TranslationKey} from '../lib/i18n';
import './SystemMessageText.css';
export function SystemMessageText({message,context={}}:{message:ChatMessage;context?:SystemMessageContext}){
  const {t}=useI18n();
  const parts=systemMessageParts(message,context,(key,values)=>t(key as TranslationKey,values));
  return <span className="system-message-copy">{parts.map((part,index)=>typeof part==='string'?part:<span key={index} data-user-id={part.userId} className={part.self?'message-system-self':'message-system-user'} title={part.self?t('message.system.selfIdentity'):undefined}>{part.name}</span>)}{message.payload?.event==='travel_map_shared'||message.payload?.kind==='map_access'&&message.payload.chat_grant?<button type="button" className="message-system-view" aria-label={t('message.system.openFootprints')} title={t('message.system.openFootprints')} onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('sermo:travel-map-message',{detail:{messageId:message.id,chatGrant:true,from:message.from}}))}}><span className="material-symbols-outlined" aria-hidden="true">north_east</span></button>:null}</span>;
}
