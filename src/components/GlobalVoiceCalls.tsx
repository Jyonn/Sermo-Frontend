import {useCallback,useEffect,useRef,useState} from 'react';
import type {Room} from 'livekit-client';
import {api,ApiError} from '../lib/api';
import {useAuth} from '../lib/auth';
import {i18n} from '../lib/language';
import {getGestureLockScope,isGestureAccessSuppressed} from '../lib/gestureLock';
import {voiceCallsEnabled,voiceErrorKey,type VoiceCall,type VoiceCapability} from '../lib/voiceCalls';
import {VoiceCallScreen} from './VoiceCallScreen';
import {VoiceCallPrompt} from './VoiceCallPrompt';
import {voiceFeedbackSurface} from '../lib/voiceFeedback';
import {showToast} from '../lib/toast';

function errorReason(error:unknown) {
  if(error instanceof DOMException&&['NotAllowedError','NotFoundError','NotReadableError','SecurityError'].includes(error.name))return 'microphone';
  return error instanceof ApiError?error.identifier.replace(/^VOICE_/,'').toLowerCase():'network';
}

function errorText(error: unknown): string {
  if(error instanceof DOMException && ['NotAllowedError','NotFoundError','NotReadableError','SecurityError'].includes(error.name))return i18n.t('voice.error.microphone');
  const reason=error instanceof ApiError?error.identifier.replace(/^VOICE_/,'').toLowerCase():'network';
  return i18n.t(voiceErrorKey(reason));
}

export function GlobalVoiceCalls() {
  const {session}=useAuth();
  const userId=session?.user.user_id;
  const userScope=session?`${session.user.space_id}:${userId}`:'';
  const [call,setCall]=useState<VoiceCall|null>(null);
  const [cap,setCap]=useState<VoiceCapability|null>(null);
  const [preflight,setPreflight]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [folded,setFolded]=useState(false);
  const [muted,setMuted]=useState(false);
  const [reconnecting,setReconnecting]=useState(false);
  const [playbackBlocked,setPlaybackBlocked]=useState(false);
  const [now,setNow]=useState(Date.now());
  const device=useRef(crypto.randomUUID());
  const snapshot=useRef<VoiceCall|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const room=useRef<Room|null>(null);
  const audio=useRef<HTMLDivElement>(null);
  const generation=useRef(0);
  const operation=useRef(false);
  const serverOffset=useRef(0);
  const live=useRef(true);
  const reconnectTimer=useRef<number|undefined>(undefined);
  const mediaReconnecting=useRef(false);
  const signalingLost=useRef(false);
  const lastToast=useRef({message:'',at:0});
  const transient=useCallback((message:string)=>{
    if(lastToast.current.message===message&&Date.now()-lastToast.current.at<3500)return;
    lastToast.current={message,at:Date.now()};showToast(message,'error');
  },[]);
  const report=useCallback((err:unknown)=>{
    if(voiceFeedbackSurface(errorReason(err))==='modal')setError(errorText(err));
    else transient(errorText(err));
  },[transient]);

  const releaseMedia=useCallback(()=>{
    window.clearTimeout(reconnectTimer.current);reconnectTimer.current=undefined;mediaReconnecting.current=false;
    const previous=room.current;room.current=null;
    void previous?.disconnect();
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    audio.current?.replaceChildren();
  },[]);
  const apply=useCallback((next:VoiceCall)=>{
    if(!live.current)return;
    serverOffset.current=next.server_now*1000-Date.now();
    const previous=snapshot.current;
    snapshot.current=next;
    setCall(next);
    if(previous?.call_id!==next.call_id){setFolded(false);setError('');setMuted(false);setPlaybackBlocked(false)}
    if(next.state==='ended'){releaseMedia();setReconnecting(false)}
  },[releaseMedia]);
  const finish=useCallback(async()=>{
    const current=snapshot.current;
    if(!current||current.state==='ended')return;
    releaseMedia();
    try{apply(await api.voiceAction(current.call_id,'end',device.current))}
    catch(err){if(live.current){transient(errorText(err));apply({...current,state:'ended',reason:'disconnected',server_now:Date.now()/1000,duration_seconds:current.connected_at?Math.min(current.max_seconds,Math.max(0,Math.ceil((Date.now()+serverOffset.current)/1000-current.connected_at))):0})}}
  },[apply,releaseMedia,transient]);

  useEffect(()=>{
    if(!voiceCallsEnabled||!userScope)return;
    live.current=true;
    let stopped=false,timer:number|undefined,requestBusy=false;
    const poll=async()=>{
      if(stopped||requestBusy||document.visibilityState!=='visible')return;
      if(isGestureAccessSuppressed(getGestureLockScope(session))){if(snapshot.current?.owned)void finish();return}
      requestBusy=true;
      const stamp=generation.current;
      try{
        const current=snapshot.current;
        const next=current&&current.owned&&current.state!=='ended'
          ?await api.voiceAction(current.call_id,'heartbeat',device.current)
          :(await api.getCurrentVoiceCall(device.current)).call;
        if(stopped||stamp!==generation.current)return;
        if(signalingLost.current){signalingLost.current=false;setError('');if(!mediaReconnecting.current)setReconnecting(false)}
        if(next&&(next.owned||next.state==='ringing'&&next.callee_id===userId))apply(next);
        else if(current&&current.state!=='ended'){
          releaseMedia();snapshot.current=null;setCall(null);
        }
      }catch(err){if(!stopped&&snapshot.current?.owned){if(!signalingLost.current)transient(errorText(err));signalingLost.current=true;setReconnecting(true)}}
      finally{requestBusy=false;if(!stopped)timer=window.setTimeout(poll,snapshot.current&&snapshot.current.state!=='ended'?1000:3000)}
    };
    const visibility=()=>{
      if(document.visibilityState!=='visible'){
        generation.current++;
        if(snapshot.current?.owned&&snapshot.current.state!=='ended')void finish();
        releaseMedia();
      }else{window.clearTimeout(timer);void poll()}
    };
    const leave=()=>{if(snapshot.current?.owned)void finish();releaseMedia()};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
    void poll();
    return()=>{
      stopped=true;live.current=false;generation.current++;window.clearTimeout(timer);
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);
      const current=snapshot.current;if(current?.owned&&current.state!=='ended')void api.voiceAction(current.call_id,'end',device.current).catch(()=>{});
      releaseMedia();snapshot.current=null;setCall(null);setPreflight(false);
    };
  // Scope changes must end the old account's media session; UI updates must not restart the poller.
  },[userScope,apply,finish,releaseMedia,transient]);

  useEffect(()=>{
    if(!voiceCallsEnabled||!userScope)return;
    const open=async(event:Event)=>{
      const chatId=(event as CustomEvent<{chatId:number}>).detail?.chatId;
      if(!chatId||operation.current)return;
      if(snapshot.current?.state!=='ended'&&snapshot.current){setFolded(false);return}
      snapshot.current=null;setCall(null);setPreflight(true);setCap(null);setError('');
      const stamp=++generation.current;
      try{const next=await api.getVoiceCapability(chatId);if(stamp===generation.current&&live.current){if(!next.can_call&&voiceFeedbackSurface(next.reason)==='toast'){setPreflight(false);transient(i18n.t(voiceErrorKey(next.reason)))}else setCap(next)}}
      catch(err){if(stamp===generation.current&&live.current){setPreflight(false);report(err)}}
    };
    window.addEventListener('frienden:voice-open',open);
    return()=>window.removeEventListener('frienden:voice-open',open);
  },[userScope,report,transient]);

  useEffect(()=>{
    if(!call?.owned||!['connecting','active'].includes(call.state)||room.current)return;
    if(!stream.current){void finish();return}
    let cancelled=false;
    const targetId=call.call_id;
    const join=async()=>{
      try{
        const [{Room,RoomEvent,Track},credentials]=await Promise.all([import('livekit-client'),api.getVoiceMedia(targetId,device.current)]);
        if(cancelled||snapshot.current?.call_id!==targetId||snapshot.current.state==='ended')return;
        const next=new Room({adaptiveStream:false,dynacast:false});room.current=next;
        next.on(RoomEvent.TrackSubscribed,(track)=>{if(track.kind===Track.Kind.Audio){const element=track.attach();element.setAttribute('playsinline','');audio.current?.append(element)}});
        next.on(RoomEvent.TrackUnsubscribed,(track)=>track.detach().forEach(element=>element.remove()));
        next.on(RoomEvent.Reconnecting,()=>{mediaReconnecting.current=true;setReconnecting(true);reconnectTimer.current??=window.setTimeout(()=>void finish(),10000)});
        next.on(RoomEvent.Reconnected,()=>{mediaReconnecting.current=false;window.clearTimeout(reconnectTimer.current);reconnectTimer.current=undefined;setReconnecting(signalingLost.current)});
        next.on(RoomEvent.AudioPlaybackStatusChanged,()=>setPlaybackBlocked(!next.canPlaybackAudio));
        next.on(RoomEvent.Disconnected,()=>{if(room.current===next&&!cancelled)void finish()});
        await next.connect(credentials.url,credentials.token);
        if(cancelled||room.current!==next){void next.disconnect();return}
        const microphone=stream.current?.getAudioTracks()[0];
        if(!microphone)throw new Error('microphone');
        await next.localParticipant.publishTrack(microphone,{source:Track.Source.Microphone});
        await next.startAudio().catch(()=>setPlaybackBlocked(true));
        setReconnecting(false);setError('');
      }catch(err){if(!cancelled){report(err);void finish()}}
    };
    void join();
    return()=>{cancelled=true};
  // One connection per call, not per state transition or clock tick.
  },[call?.call_id,Boolean(call?.owned&&['connecting','active'].includes(call.state)),finish,report]);

  useEffect(()=>{
    if(!call||call.state==='ended')return;
    const timer=window.setInterval(()=>setNow(Date.now()),250);
    return()=>window.clearInterval(timer);
  },[call?.call_id,call?.state]);
  const elapsed=call?.connected_at?Math.max(0,Math.floor((now+serverOffset.current)/1000-call.connected_at)):0;
  const remaining=call?.deadline_at?Math.min(call.max_seconds,Math.max(0,Math.ceil(call.deadline_at-(now+serverOffset.current)/1000))):call?.max_seconds??0;
  useEffect(()=>{if(call?.state==='active'&&remaining<=0)void finish()},[call?.state,remaining,finish]);

  const microphone=async()=>{
    if(!navigator.mediaDevices?.getUserMedia)throw new DOMException('Microphone unavailable','NotFoundError');
    const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(!live.current||document.visibilityState!=='visible'){media.getTracks().forEach(track=>track.stop());throw new DOMException('Not in foreground','NotAllowedError')}
    stream.current=media;
  };
  const start=async()=>{
    if(!cap?.can_call||operation.current)return;
    operation.current=true;setBusy(true);setError('');const stamp=++generation.current;
    try{await microphone();const next=await api.createVoiceCall(cap.chat_id,crypto.randomUUID(),device.current);if(stamp!==generation.current||!live.current){void api.voiceAction(next.call_id,'end',device.current).catch(()=>{});releaseMedia();return}setPreflight(false);apply(next)}
    catch(err){releaseMedia();if(live.current)report(err)}
    finally{operation.current=false;if(live.current)setBusy(false)}
  };
  const answer=async()=>{
    if(!call||operation.current)return;
    operation.current=true;setBusy(true);setError('');const id=call.call_id;
    try{await microphone();const next=await api.voiceAction(id,'accept',device.current);if(!live.current||document.visibilityState!=='visible'){releaseMedia();void api.voiceAction(id,'end',device.current).catch(()=>{});return}apply(next)}
    catch(err){releaseMedia();if(live.current)report(err)}
    finally{operation.current=false;if(live.current)setBusy(false)}
  };
  const toggleMute=()=>{
    const next=!muted;stream.current?.getAudioTracks().forEach(track=>{track.enabled=!next});setMuted(next);
  };
  return <><div ref={audio} hidden/>
    {call?<VoiceCallScreen call={call} incoming={call.callee_id===userId} folded={folded} muted={muted} busy={busy} elapsed={Math.min(elapsed,call.max_seconds)} remaining={remaining} reconnecting={reconnecting} playbackBlocked={playbackBlocked} onFold={setFolded} onMute={toggleMute} onAnswer={()=>void answer()} onEnd={()=>void finish()} onDismiss={()=>{snapshot.current=null;setCall(null);setError('')}} onPlayback={()=>void room.current?.startAudio().then(()=>setPlaybackBlocked(false))}/>:null}
    <VoiceCallPrompt open={preflight||Boolean(error)} cap={preflight?cap:null} error={error} busy={busy} onClose={()=>{if(!busy){generation.current++;setPreflight(false);setError('')}}} onConfirm={()=>void start()}/>
  </>;
}
