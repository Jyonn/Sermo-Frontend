import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { createNoiseReducedAudioCapture, preferredAudioMimeType, audioFileExtension } from "../lib/audioCapture";
import { HoldToTalkRecorder, holdGesture, type HoldGesture, type HoldRecordingState } from "../lib/holdToTalk";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";

export function HoldToTalkInput({disabled=false,onSend,onBusyChange}:{disabled?:boolean;onSend:(file:File,duration:number)=>Promise<unknown>;onBusyChange?:(busy:boolean)=>void}) {
  const { t }=useI18n();
  const [state,setState]=useState<HoldRecordingState>({phase:"idle",duration:0,bars:[]});
  const [gesture,setGesture]=useState<HoldGesture>("idle");
  const [sending,setSending]=useState(false);
  const pointer=useRef<{id:number;y:number;gesture:HoldGesture}|null>(null);
  const options=useRef({onSend,onBusyChange,t});options.current={onSend,onBusyChange,t};
  const mounted=useRef(true);
  const recorder=useRef<HoldToTalkRecorder|null>(null);
  if(!recorder.current) recorder.current=new HoldToTalkRecorder({
    capture:createNoiseReducedAudioCapture,
    recorder:stream=>{const mimeType=preferredAudioMimeType();return mimeType ? new MediaRecorder(stream,{mimeType}) : new MediaRecorder(stream);},
    onState:next=>{if(!mounted.current)return;setState(next);if(next.phase==="idle"){setGesture("idle");pointer.current=null;}},
    onError:error=>{if(mounted.current)showToast(options.current.t(error instanceof Error && error.message==="too-short" ? "audio.tooShort" : error instanceof DOMException && error.name==="NotAllowedError" ? "audio.permissionRequired" : "audio.startUnavailable"),"error");},
    onRecorded:(blob,duration,mime)=>{if(!mounted.current)return;setSending(true);void options.current.onSend(new File([blob],`voice-message.${audioFileExtension(mime)}`,{type:mime}),duration).catch(()=>showToast(options.current.t("audio.sendRetry"),"error")).finally(()=>{if(mounted.current)setSending(false);});},
  });
  const busy=sending || state.phase!=="idle";
  useEffect(()=>{options.current.onBusyChange?.(busy);},[busy]);
  useEffect(()=>{
    mounted.current=true;
    const cancel=()=>{pointer.current=null;recorder.current?.cancel();};
    const hidden=()=>{if(document.hidden)cancel();};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")cancel();};
    window.addEventListener("blur",cancel);document.addEventListener("visibilitychange",hidden);window.addEventListener("keydown",escape);
    return()=>{mounted.current=false;recorder.current?.cancel();options.current.onBusyChange?.(false);window.removeEventListener("blur",cancel);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("keydown",escape);};
  },[]);
  const begin=(event:PointerEvent<HTMLButtonElement>)=>{
    if(disabled||busy||!event.isPrimary||event.button!==0)return;
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined"){showToast(t("audio.unsupported"),"error");return;}
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    // start() resets the old session synchronously before this pointer is installed.
    void recorder.current?.start();pointer.current={id:event.pointerId,y:event.clientY,gesture:"recording"};setGesture("recording");
  };
  const move=(event:PointerEvent<HTMLButtonElement>)=>{const active=pointer.current;if(!active||active.id!==event.pointerId)return;active.gesture=holdGesture(active.y,event.clientY,window.innerHeight,active.gesture!=="recording");setGesture(active.gesture);};
  const end=(event:PointerEvent<HTMLButtonElement>,cancel=false)=>{const active=pointer.current;if(!active||active.id!==event.pointerId)return;pointer.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setGesture("idle");if(cancel||active.gesture==="cancel")recorder.current?.cancel();else recorder.current?.stop();};
  return <>
    <button className={`mobile-voice-hold is-${gesture}`} disabled={disabled||sending} onContextMenu={event=>event.preventDefault()}
      onBlur={()=>{pointer.current=null;recorder.current?.cancel();setGesture("idle");}}
      onPointerDown={begin} onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event,true)}
      onKeyDown={event=>{if(event.key!==" "&&event.key!=="Enter")return;event.preventDefault();if(!event.repeat&&!disabled&&!busy){void recorder.current?.start();setGesture("recording");}}}
      onKeyUp={event=>{if(event.key===" "||event.key==="Enter"){event.preventDefault();setGesture("idle");recorder.current?.stop();}}} type="button">
      {sending?t("common.sendingPlain"):state.phase==="requesting"?t("audio.preparingMicrophone"):t("composer.holdToTalk")}
    </button>
    {gesture!=="idle" ? createPortal(<div className={`mobile-voice-mask is-${gesture}`} aria-live="polite">
      {gesture==="recording"?<div className="mobile-voice-initial-hint"><span className="material-symbols-outlined">keyboard_arrow_up</span><strong>{t("composer.slideToCancel")}</strong></div>:null}
      {gesture==="sliding"?<div className="mobile-voice-slide-guide"><span className="material-symbols-outlined">arrow_upward</span><strong>{t("composer.keepSliding")}</strong></div>:null}
      {gesture==="sliding"||gesture==="cancel"?<div className="mobile-voice-cancel-target"><span className="material-symbols-outlined">{gesture==="cancel"?"close":"keyboard_arrow_up"}</span><strong>{t(gesture==="cancel"?"composer.releaseToCancel":"composer.moveHereToCancel")}</strong></div>:null}
      <div className="mobile-voice-recording-deck"><div className="mobile-voice-recording-meta"><span><i aria-hidden="true"/>{t(state.phase==="requesting"?"audio.preparingMicrophone":"composer.recording")}</span><time>{Math.floor(state.duration/60)}:{String(Math.floor(state.duration%60)).padStart(2,"0")}</time></div><div className="mobile-voice-live-waveform" aria-hidden="true">{state.bars.map((level,index)=><i key={index} style={{"--voice-height":`${Math.max(4,level*36)}px`} as CSSProperties}/>)}</div></div>
    </div>,document.body):null}
  </>;
}
