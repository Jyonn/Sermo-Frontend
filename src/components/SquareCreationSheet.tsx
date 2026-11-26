import {ActionSheet} from './ActionSheet';
import {useI18n} from '../lib/language';
export type SquareCreationKind='text'|'photo'|'voice'|'video'|'external';
export function SquareCreationSheet({open,onClose,onChoose,voiceAllowed,videoAllowed,description,onQuota,editing=false}:{open:boolean;onClose:()=>void;onChoose:(kind:SquareCreationKind)=>void;voiceAllowed:boolean;videoAllowed:boolean;description?:string;onQuota?:()=>void;editing?:boolean}){
  const {t}=useI18n();
  const items=[['text','notes','square.writeText'],['photo','image','square.photo'],['voice','mic','square.voice'],['video','videocam','square.video'],['external','link','square.shareExternal']] as const;
  return <ActionSheet open={open} onClose={onClose} title={t(editing?'square.addMedia':'square.creationTitle')} headerAccessory={onQuota&&<button className="square-creation-quota" onClick={onQuota} type="button"><span>{description||t('square.quotaTitle')}</span><span>{t('square.viewQuota')}</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>} compactHeader actions={items.filter(([key])=>!editing||key!=='text').map(([key,icon,label])=>({key,label:t(label),icon:<span className="material-symbols-outlined">{icon}</span>,description:key==='voice'&&!voiceAllowed?t('square.voiceUnlock'):key==='video'&&!videoAllowed?t('square.videoUnlock'):undefined,disabled:key==='voice'&&!voiceAllowed||key==='video'&&!videoAllowed,onSelect:()=>onChoose(key)}))}/>;
}
