import {useI18n} from '../lib/language';
import {voiceErrorKey,type VoiceCapability} from '../lib/voiceCalls';
import {ConfirmDialog} from './ConfirmDialog';
import {ActionSheet} from './ActionSheet';
import {ChatActionIcon} from './ChatActionIcon';

export function VoiceCallPrompt({open,cap,error='',busy=false,onClose,onConfirm}:{
  open:boolean;cap?:VoiceCapability|null;error?:string;busy?:boolean;onClose:()=>void;onConfirm?:()=>void|Promise<void>;
}) {
  const {t}=useI18n();
  const ready=Boolean(cap?.can_call);
  const title = t(cap?.group ? 'voice.groupTitle' : 'voice.title');
  if(error||cap&&!ready)return <ConfirmDialog open={open} title={title} className="voice-call-prompt"
    description={error||t(voiceErrorKey(cap!.reason))} confirmLabel={t('common.close')} showCancelButton={false}
    busy={busy} onClose={onClose} onConfirm={onClose}/>;
  return <ActionSheet open={open} title={title} className="voice-call-prompt" showHeader={false} closeOnSelect={false} onClose={onClose}
    actions={[{key:'call',label:cap?.ongoing ? t('voice.joinGroup') : title,icon:<ChatActionIcon action="call"/>,disabled:!ready||busy,onSelect:async()=>{await onConfirm?.()}}]}/>;
}
