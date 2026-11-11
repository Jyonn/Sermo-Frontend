import {useRef} from 'react';
import {createPortal} from 'react-dom';
import {useI18n} from '../lib/language';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useModalFocus} from '../lib/modalFocus';
import {voiceStatus,voiceTime,type VoiceCall} from '../lib/voiceCalls';
import {UserAvatar} from './UserAvatar';
type ControlKey = 'voice.answer'|'voice.decline'|'voice.cancel'|'voice.hangup'|'voice.mute'|'voice.unmute'|'common.close';
import './VoiceCalls.css';

interface Props {
  call: VoiceCall;
  incoming: boolean;
  folded: boolean;
  muted: boolean;
  busy: boolean;
  elapsed: number;
  remaining: number;
  reconnecting?: boolean;
  playbackBlocked?: boolean;
  error?: string;
  onFold: (folded:boolean)=>void;
  onMute: ()=>void;
  onAnswer: ()=>void;
  onEnd: ()=>void;
  onDismiss: ()=>void;
  onPlayback?: ()=>void;
}

export function VoiceCallScreen({call,incoming,folded,muted,busy,elapsed,remaining,reconnecting,playbackBlocked,error,onFold,onMute,onAnswer,onEnd,onDismiss,onPlayback}:Props) {
  const {t}=useI18n();
  const root=useRef<HTMLDivElement>(null);
  const ended=call.state==='ended';
  useBodyScrollLock(!folded);
  useModalFocus(root,!folded,()=>onFold(true));
  const label=t(reconnecting?'voice.reconnecting':voiceStatus(call,incoming));
  const active=call.state==='active';
  const control=(icon:string,key:ControlKey,onClick:()=>void,kind='',disabled=false)=><button className={`voice-control ${kind}`} onClick={onClick} disabled={disabled} type="button"><span className="voice-control-disc"><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></span><span>{t(key)}</span></button>;
  return createPortal(folded?<div className="voice-folded" role="region" aria-label={t('voice.title')}><button type="button" className="voice-folded-open" onClick={()=>onFold(false)}><span className="material-symbols-outlined" aria-hidden="true">call</span><span><strong>{call.peer.name}</strong><small>{active?voiceTime(elapsed):label}</small></span><span className="material-symbols-outlined" aria-hidden="true">open_in_full</span></button><button type="button" className="voice-folded-end" aria-label={t(ended?'common.close':'voice.hangup')} disabled={busy} onClick={ended?onDismiss:onEnd}><span className="material-symbols-outlined" aria-hidden="true">{ended?'close':'call_end'}</span></button></div>:
    <div className={`voice-screen${active?' is-active':''}${ended?' is-ended':''}`} ref={root} role="dialog" aria-modal="true" aria-labelledby="voice-call-name" tabIndex={-1} data-overlay-layer>
      <header className="voice-screen-header"><span>{t('voice.title')}</span><button className="icon-button" type="button" aria-label={t('voice.fold')} onClick={()=>onFold(true)}><span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span></button></header>
      <div className="voice-screen-person"><div className={`voice-avatar-orbit${call.state==='ringing'?' is-ringing':''}`}><UserAvatar className="voice-person-avatar" name={call.peer.name} userId={call.peer.user_id} uri={call.peer.avatar_uri} cacheKey={call.peer.avatar_cache_key}/></div><h1 id="voice-call-name">{call.peer.name}</h1><p className="voice-state" role="status">{label}</p>
      <div className="voice-clock">{active?voiceTime(elapsed):ended&&call.duration_seconds?voiceTime(call.duration_seconds):''}</div>
      {!ended?<p className={`voice-time-left${active&&remaining<=15?' is-low':''}`}>{t(active?'voice.remaining':'voice.maximum',{time:voiceTime(active?remaining:call.max_seconds)})}</p>:null}
      </div>
      <div className="voice-screen-bottom">{error?<p role="alert" className="voice-error">{error}</p>:null}{playbackBlocked&&!ended?<button className="voice-playback" type="button" onClick={onPlayback}>{t('voice.enableSound')}</button>:null}
      <div className="voice-controls">{ended?control('close','common.close',onDismiss):incoming&&call.state==='ringing'?<>{control('call_end','voice.decline',onEnd,'is-danger',busy)}{control('call','voice.answer',onAnswer,'is-answer',busy)}</>:<>{active||call.state==='connecting'?control(muted?'mic_off':'mic',muted?'voice.unmute':'voice.mute',onMute,muted?'is-muted':'',busy):null}{control('call_end',call.state==='ringing'?'voice.cancel':'voice.hangup',onEnd,'is-danger',busy)}</>}</div>
      </div>
    </div>,document.body);
}
