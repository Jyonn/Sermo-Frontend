import {ActionSheet} from './ActionSheet';
import {useI18n} from '../lib/language';
export type SquareCreationKind='text'|'photo'|'voice'|'video'|'external';
export function SquareCreationSheet({open,onClose,onChoose,voiceAllowed,videoAllowed,description}:{open:boolean;onClose:()=>void;onChoose:(kind:SquareCreationKind)=>void;voiceAllowed:boolean;videoAllowed:boolean;description?:string}){
  const {t}=useI18n();
  const items=[['text','notes','square.writeText'],['photo','image','square.photo'],['voice','mic','square.voice'],['video','videocam','square.video'],['external','link','square.shareExternal']] as const;
  return <ActionSheet open={open} onClose={onClose} title={t('square.creationTitle')} description={description} compactHeader actions={items.map(([key,icon,label])=>({key,label:t(label),icon:<span className="material-symbols-outlined">{icon}</span>,description:key==='voice'&&!voiceAllowed?t('square.voiceUnlock'):key==='video'&&!videoAllowed?t('square.videoUnlock'):undefined,disabled:key==='voice'&&!voiceAllowed||key==='video'&&!videoAllowed,onSelect:()=>onChoose(key)}))}/>;
}
