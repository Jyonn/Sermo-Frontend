import {useI18n} from '../lib/language';
import {openVoiceCall,voiceCallsEnabled,voiceStatus,voiceTime,type VoiceCallRecord} from '../lib/voiceCalls';
import {CallIcon} from './CallIcon';

export function VoiceCallBubble({call,incoming}:{call:VoiceCallRecord;incoming:boolean}) {
  const {t}=useI18n();
  return <button className="message-voice-call" type="button" disabled={!voiceCallsEnabled} onClick={event=>{event.stopPropagation();openVoiceCall(call.chat_id)}}>
    <span className="message-call-symbol"><CallIcon/></span><span className="message-call-copy"><strong>{t(call.group ? 'voice.groupTitle' : 'voice.title')}</strong><small>{t(call.group && call.state !== 'ended' ? 'voice.joinGroup' : voiceStatus(call,incoming))}</small></span>
    {call.state==='ended'&&call.duration_seconds>0?<span className="message-call-duration">{voiceTime(call.duration_seconds)}</span>:null}
  </button>;
}
