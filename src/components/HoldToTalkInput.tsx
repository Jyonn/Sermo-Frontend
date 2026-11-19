import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { createNoiseReducedAudioCapture, preferredAudioMimeType, audioFileExtension } from '../lib/audioCapture';
import { HoldToTalkRecorder, voiceDropGesture, type HoldGesture, type HoldRecordingState } from '../lib/holdToTalk';
import { LiveTranscription, type LiveTranscript, type LiveRecordingResult } from '../lib/liveTranscription';
import {startChatLiveTranscription} from '../lib/chatLiveTranscription';
import { useI18n } from '../lib/language';
import { showToast } from '../lib/toast';
import {useMobileVoiceInputMode, type MobileVoiceInputMode} from '../lib/mobileVoiceInputMode';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useModalFocus} from '../lib/modalFocus';
import './HoldToTalkInput.css';

const emptyTranscript:LiveTranscript={status:'connecting',text:'',finalText:'',partialText:''};
interface VoiceReview {file:File;duration:number;result:LiveRecordingResult|null}

export function HoldToTalkInput({disabled=false,onSend,onText,onBusyChange,admin=false}:{disabled?:boolean;onSend:(file:File,duration:number,receipt?:string)=>Promise<unknown>;onText:(text:string)=>void;onBusyChange?:(busy:boolean)=>void;admin?:boolean}) {
  const {t}=useI18n();
  const [preferredMode]=useMobileVoiceInputMode();
  const activeMode=useRef<MobileVoiceInputMode>(preferredMode);
  const [state,setState]=useState<HoldRecordingState>({phase:'idle',duration:0,bars:[]});
  const [gesture,setGesture]=useState<HoldGesture>('idle');
  const [transcript,setTranscript]=useState(emptyTranscript);
  const [finishing,setFinishing]=useState(false);
  const [sending,setSending]=useState(false);
  const [stopping,setStopping]=useState(false);
  const [review,setReview]=useState<VoiceReview|null>(null);
  const reviewAction=useRef(false);
  const sendButton=useRef<HTMLButtonElement|null>(null);
  const stopRequested=useRef(false);
  const overlay=useRef<HTMLDivElement|null>(null);
  const pointer=useRef<{id:number;y:number}|null>(null);
  const disposition=useRef<HoldGesture>('recording');
  const targets=useRef<HTMLDivElement|null>(null);
  const recording=useRef(false);
  const textScroll=useRef<HTMLDivElement|null>(null);
  const live=useRef<LiveTranscription|null>(null);
  const generation=useRef(0);
  const options=useRef({onSend,onText,onBusyChange,t,admin});options.current={onSend,onText,onBusyChange,t,admin};
  const mounted=useRef(true);
  const recorder=useRef<HoldToTalkRecorder|null>(null);
  const send=async(file:File,duration:number,receipt?:string)=>{
    setSending(true);
    try {await options.current.onSend(file,duration,receipt);}
    catch {if(mounted.current)showToast(options.current.t('audio.sendRetry'),'error');}
    finally {if(mounted.current)setSending(false);}
  };
  if(!recorder.current)recorder.current=new HoldToTalkRecorder({
    capture:async()=>{
      const session=live.current;
      const capture=await createNoiseReducedAudioCapture();
      await session?.attach(capture.stream,capture.analyser?.context as AudioContext|null);
      return capture;
    },
    recorder:stream=>{const mime=preferredAudioMimeType();return mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);},
    beforeStop:async()=>{await live.current?.flush();},
    onState:next=>{recording.current=next.phase!=='idle';if(!mounted.current)return;setState(next);if(next.phase==='idle'){if(activeMode.current!=='tap')setGesture('idle');setStopping(false);pointer.current=null;}},
    onError:error=>{
      live.current?.cancel();
      if(mounted.current){setGesture('idle');setReview(null);showToast(options.current.t(error instanceof Error&&error.message==='too-short'?'audio.tooShort':error instanceof DOMException&&error.name==='NotAllowedError'?'audio.permissionRequired':'audio.startUnavailable'),'error');}
    },
    onRecorded:(blob,duration,mime)=>{
      if(!mounted.current)return;
      const session=live.current,token=generation.current;
      if(disposition.current==='cancel'){session?.cancel();return;}
      if(activeMode.current==='tap'){
        const recorded={file:new File([blob],`voice-message.${audioFileExtension(mime)}`,{type:mime}),duration,result:null};
        setReview(recorded);setFinishing(true);
        void (session?.finish()??Promise.resolve({ok:false,text:''})).then(result=>{
          if(!mounted.current||token!==generation.current)return;
          setFinishing(false);setReview({...recorded,result});
        });
        return;
      }
      if(disposition.current!=='text'){
        setFinishing(true);
        void (session?.finish()??Promise.resolve({ok:false,text:'',receipt:undefined})).then(result=>{
          if(!mounted.current||token!==generation.current)return;
          setFinishing(false);
          void send(new File([blob],`voice-message.${audioFileExtension(mime)}`,{type:mime}),duration,result.receipt);
        });
        return;
      }
      setFinishing(true);
      void (session?.finish()??Promise.resolve({ok:false,text:''})).then(result=>{
        if(!mounted.current||token!==generation.current)return;
        setFinishing(false);
        const text=result.text.trim();
        if(!text)showToast(options.current.t('voiceLive.noText'),'info');
        else if(!result.ok)showToast(options.current.t('voiceLive.incomplete'),'info');
        options.current.onText(text);
      });
    },
  });
  const busy=sending||finishing||stopping||Boolean(review)||state.phase!=='idle';
  const tap=(gesture==='idle'?preferredMode:activeMode.current)==='tap';
  const Target=tap?'button':'div';
  useEffect(()=>{options.current.onBusyChange?.(busy);},[busy]);
  useEffect(()=>{const el=textScroll.current;if(el)el.scrollTop=el.scrollHeight;},[transcript.text]);
  useEffect(()=>{if(review?.result)sendButton.current?.focus();},[review?.result]);
  const cancel=()=>{generation.current++;pointer.current=null;live.current?.cancel();recorder.current?.cancel();setGesture('idle');setFinishing(false);setStopping(false);setReview(null);};
  useBodyScrollLock(tap&&gesture!=='idle');
  useModalFocus(overlay,tap&&gesture!=='idle',cancel);
  useEffect(()=>{
    mounted.current=true;
    const blur=()=>{if(recording.current)cancel();};
    const hidden=()=>{if(document.hidden)blur();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',escape);
    return()=>{mounted.current=false;generation.current++;live.current?.cancel();recorder.current?.cancel();options.current.onBusyChange?.(false);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',escape);};
  },[]);
  const start=()=>{
    if(disabled||busy||recording.current)return;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){showToast(t('audio.unsupported'),'error');return;}
    activeMode.current=preferredMode;stopRequested.current=false;reviewAction.current=false;
    live.current?.cancel();const token=++generation.current;
    disposition.current='recording';setTranscript(emptyTranscript);
    const session=startChatLiveTranscription(value=>{if(mounted.current&&token===generation.current)setTranscript(value);},options.current.admin);live.current=session;
    void recorder.current?.start();setGesture('recording');
  };
  const begin=(event:PointerEvent<HTMLButtonElement>)=>{
    if(tap||disabled||busy||!event.isPrimary||event.button!==0)return;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){showToast(t('audio.unsupported'),'error');return;}
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    start();pointer.current={id:event.pointerId,y:event.clientY};
  };
  const move=(event:PointerEvent<HTMLButtonElement>)=>{
    const active=pointer.current,box=targets.current?.getBoundingClientRect();if(!active||active.id!==event.pointerId||!box)return;
    const next=voiceDropGesture(active.y,event.clientX,event.clientY,box);
    disposition.current=next;setGesture(next);
  };
  const end=(event:PointerEvent<HTMLButtonElement>,aborted=false)=>{
    const active=pointer.current;if(!active||active.id!==event.pointerId)return;
    pointer.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(aborted||disposition.current==='cancel'||state.phase==='requesting')cancel();else recorder.current?.stop();
  };
  const finishTap=()=>{
    if(state.phase!=='recording'||stopRequested.current)return;
    stopRequested.current=true;setStopping(true);recorder.current?.stop();
  };
  const sendReview=()=>{
    if(!review?.result||reviewAction.current)return;
    reviewAction.current=true;const recorded=review,receipt=review.result.receipt;
    setReview(null);setGesture('idle');
    void send(recorded.file,recorded.duration,receipt);
  };
  const textReview=()=>{
    if(!review?.result||reviewAction.current)return;
    const text=review.result.text.trim();
    if(!text){showToast(t('voiceLive.noText'),'info');return;}
    reviewAction.current=true;
    if(!review.result.ok)showToast(t('voiceLive.incomplete'),'info');
    setReview(null);setGesture('idle');options.current.onText(text);
  };
  const duration=review?.duration??state.duration;
  return <>
    <button className={`mobile-voice-hold is-${gesture}`} disabled={disabled||sending||finishing||stopping||Boolean(review)} aria-busy={finishing||sending||stopping} onContextMenu={event=>event.preventDefault()}
      onClick={tap?()=>{if(recording.current)finishTap();else start();}:undefined}
      onBlur={()=>{if(pointer.current)cancel();}}
      onPointerDown={begin} onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event,true)}
      onKeyDown={event=>{if(tap)return;if(event.key===' '||event.key==='Enter'){event.preventDefault();if(!event.repeat&&!disabled&&!busy)start();}if(event.key==='ArrowLeft'&&recording.current){disposition.current='cancel';setGesture('cancel');}if(event.key==='ArrowRight'&&recording.current){disposition.current='text';setGesture('text');}}}
      onKeyUp={event=>{if(tap)return;if(event.key===' '||event.key==='Enter'){event.preventDefault();if(disposition.current==='cancel'||state.phase==='requesting')cancel();else recorder.current?.stop();}}} type="button">
      {sending?t('common.sendingPlain'):finishing||stopping?t('voiceLive.finishing'):state.phase==='requesting'?t('audio.preparingMicrophone'):t(tap?'voiceInput.tapToRecord':'composer.holdToTalk')}
    </button>
    {gesture!=='idle'?createPortal(<div ref={overlay} tabIndex={tap?-1:undefined} role={tap?'dialog':undefined} aria-modal={tap?true:undefined} aria-label={tap?t('audio.record'):undefined} onKeyDownCapture={event=>{if(tap&&event.repeat&&(event.key==='Enter'||event.key===' '))event.preventDefault();}} className={`voice-live-overlay is-${gesture}${tap?' is-tap':''}`}>
      <div className="voice-live-transcript">
        <div className="voice-live-caption"><i/>{t(tap&&review?(finishing?'voiceLive.finishing':'voiceInput.review'):state.phase==='requesting'?'audio.preparingMicrophone':transcript.status==='connecting'?'voiceLive.connecting':transcript.status==='unavailable'?'voiceLive.unavailable':'voiceLive.listening')}<time>{String(Math.floor(duration/60))}:{String(Math.floor(duration%60)).padStart(2,'0')}</time></div>
        <div className="voice-live-copy" ref={textScroll} aria-live="polite" aria-atomic="true">{transcript.text?<><span>{transcript.finalText}</span>{transcript.finalText&&transcript.partialText?'\n':''}<span className="is-partial">{transcript.partialText}</span></>:<span className="voice-live-placeholder">{t('voiceLive.placeholder')}</span>}</div>
      </div>
      {!tap||review?<div className="voice-live-targets" ref={targets}>
        <Target type={tap?'button':undefined} onClick={tap?cancel:undefined} className={`voice-live-target is-cancel${gesture==='cancel'?' is-selected':''}`}><span className="material-symbols-outlined" aria-hidden="true">close</span><strong>{t(gesture==='cancel'?'composer.releaseToCancel':'common.cancel')}</strong></Target>
        <Target type={tap?'button':undefined} disabled={tap&&!review?.result} onClick={tap?textReview:undefined} className={`voice-live-target is-text${gesture==='text'?' is-selected':''}`}><span className="material-symbols-outlined" aria-hidden="true">text_fields</span><strong>{t(gesture==='text'?'voiceLive.releaseText':'voiceLive.toText')}</strong></Target>
      </div>:null}
      <div className="voice-live-bottom"><div className="voice-live-wave" aria-hidden="true">{(review?Array(12).fill(.22):state.bars).map((level,index)=><i key={index} style={{'--voice-scale':Math.max(.12,level)} as CSSProperties}/>)}</div>{tap?(review?<button ref={sendButton} type="button" className="voice-live-stop is-send" disabled={!review.result} onClick={sendReview}><span className="material-symbols-outlined" aria-hidden="true">send</span>{t(finishing?'voiceLive.finishing':'common.send')}</button>:<button type="button" className="voice-live-stop" disabled={state.phase!=='recording'||stopping} onClick={finishTap}><span className="material-symbols-outlined" aria-hidden="true">stop</span>{t(stopping?'voiceLive.finishing':'voiceInput.stop')}</button>):<p>{t(gesture==='cancel'?'composer.releaseToCancel':gesture==='text'?'voiceLive.releaseText':'voiceLive.releaseVoice')}</p>}</div>
    </div>,document.body):null}
  </>;
}
