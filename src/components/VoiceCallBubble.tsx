import {useI18n} from '../lib/language';
import {openVoiceCall,voiceCallsEnabled,voiceStatus,voiceTime,type VoiceCallRecord} from '../lib/voiceCalls';

export function VoiceCallBubble({call,incoming}:{call:VoiceCallRecord;incoming:boolean}) {
  const {t}=useI18n();
  return <button className="message-voice-call" type="button" disabled={!voiceCallsEnabled} onClick={event=>{event.stopPropagation();openVoiceCall(call.chat_id)}}>
    <span className="material-symbols-outlined" aria-hidden="true">{call.state==='ended'?'call_end':'call'}</span><span><strong>{t(voiceStatus(call,incoming))}{call.state==='ended'&&call.duration_seconds>0?` · ${voiceTime(call.duration_seconds)}`:''}</strong><small>{t('voice.title')}</small></span>
  </button>;
}
