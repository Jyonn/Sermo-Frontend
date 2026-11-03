import {BottomSheet} from './BottomSheet';
import {useI18n} from '../lib/language';
export function SquareVoiceRecorder({open,recording,starting,duration,maximum,preview,error,onRecord,onClose,onClear,onDone}:{open:boolean;recording:boolean;starting:boolean;duration:number;maximum:number;preview:string|null;error:string;onRecord:()=>void;onClose:()=>void;onClear:()=>void;onDone:()=>void}){
  const {t}=useI18n(),time=`${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}`;
  return <BottomSheet open={open} onClose={onClose} title={t('square.voice')} bodyClassName="square-voice-sheet">
    {error?<div className="square-inline-error" role="alert">{error}</div>:null}
    <div className={`square-voice-stage${recording?' is-recording':''}`}><div className="square-voice-bars" aria-hidden="true">{Array.from({length:25},(_,index)=><i key={index}/>)}</div><strong>{time}<small> / {Math.floor(maximum/60)}:00</small></strong></div>
    <button className="square-record-button" disabled={starting} onClick={onRecord} type="button" aria-label={t(recording?'square.stopRecording':'square.startRecording')}>{starting?<span className="media-wait-spinner"/>:<span className="material-symbols-outlined">{recording?'stop':'mic'}</span>}</button>
    <p className="square-voice-help">{starting?t('common.loading'):recording?t('square.tapToStop'):preview?t('square.recordAgain'):t('square.tapToRecord')}</p>
    {preview&&!recording?<audio className="square-voice-preview" controls src={preview} preload="metadata"/>:null}
    {!recording&&preview?<div className="square-voice-actions"><button className="secondary-button" onClick={onClear} type="button">{t('square.recordAgain')}</button><button className="primary-button" onClick={onDone} type="button">{t('square.useRecording')}</button></div>:null}
  </BottomSheet>;
}
