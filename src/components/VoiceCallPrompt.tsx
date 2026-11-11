import {useI18n} from '../lib/language';
import {voiceTime,voiceErrorKey,type VoiceCapability} from '../lib/voiceCalls';
import {ConfirmDialog} from './ConfirmDialog';
import {UserAvatar} from './UserAvatar';

export function VoiceCallPrompt({open,cap,error='',busy=false,onClose,onConfirm}:{
  open:boolean;cap?:VoiceCapability|null;error?:string;busy?:boolean;onClose:()=>void;onConfirm?:()=>void;
}) {
  const {t}=useI18n();
  const ready=Boolean(cap?.can_call);
  const loading=!cap&&!error;
  return <ConfirmDialog open={open} title={t('voice.title')} className="voice-call-prompt"
    description={error||(!ready&&cap?t(voiceErrorKey(cap.reason)):undefined)}
    confirmLabel={t(ready?'voice.dial':'common.close')} showCancelButton={ready||loading}
    busy={busy} confirmDisabled={loading} onClose={onClose} onConfirm={ready&&onConfirm?onConfirm:onClose}>
    {ready&&cap?<div className="voice-preflight-person"><UserAvatar className="voice-preflight-avatar" name={cap.peer.name} userId={cap.peer.user_id} uri={cap.peer.avatar_uri}/><span><strong>{cap.peer.name}</strong><small>{t('voice.maximum',{time:voiceTime(cap.max_seconds)})}</small></span></div>:loading?<p role="status" className="voice-preflight-error">{t('common.loading')}</p>:null}
  </ConfirmDialog>;
}
