import {BottomSheet} from './BottomSheet';
import {useI18n} from '../lib/language';
import {SquareVoicePreview,voiceTime} from './SquareVoicePreview';
import './SquareVoice.css';
export function SquareVoiceRecorder({open,recording,starting,duration,maximum,preview,error,onRecord,onClose,onClear,onDone}:{open:boolean;recording:boolean;starting:boolean;duration:number;maximum:number;preview:string|null;error:string;onRecord:()=>void;onClose:()=>void;onClear:()=>void;onDone:()=>void}){
  const {t}=useI18n(),review=!!preview&&!recording&&!starting;
  return <BottomSheet open={open} onClose={onClose} title={t('square.voice')} className="square-voice-dialog" bodyClassName="square-capture-body">
    {error?<div className="square-inline-error" role="alert">{error}</div>:null}
    {review?<>
      <p className="square-capture-status"><span className="material-symbols-outlined">check_circle</span>{t('square.voiceReady')}</p>
      <SquareVoicePreview key={preview} uri={preview} duration={duration}/>
      <div className="square-capture-actions"><button className="square-capture-again" onClick={()=>{onClear();onRecord()}} type="button"><span className="material-symbols-outlined">replay</span>{t('square.recordAgain')}</button><button className="square-capture-use" onClick={onDone} type="button">{t('square.useRecording')}<span className="material-symbols-outlined">arrow_forward</span></button></div>
    </>:<>
      <div className={`square-capture-session${recording?' is-recording':''}`}>
        <div className="square-capture-heading"><span>{t(starting?'common.loading':recording?'square.recording':'square.tapToRecord')}</span><small>{t('square.recordingLimit',{seconds:maximum})}</small></div>
        <div className="square-capture-control"><button disabled={starting} onClick={onRecord} type="button" aria-label={t(recording?'square.stopRecording':'square.startRecording')}>{starting?<span className="media-wait-spinner"/>:<span className="material-symbols-outlined">{recording?'stop':'mic'}</span>}</button><strong>{voiceTime(recording?duration:0)}</strong></div>
        <progress max={maximum} value={recording?duration:0} aria-label={t('square.recording')}/>
      </div>
      <p className="square-capture-hint">{t(recording?'square.tapToStop':'square.recordingPrivacy')}</p>
    </>}
  </BottomSheet>;
}
