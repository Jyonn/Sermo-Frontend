import {useEffect,useState} from 'react';
import {useI18n} from '../lib/language';
import {voiceTime,type VoiceCall} from '../lib/voiceCalls';
import {VoiceCallScreen} from '../components/VoiceCallScreen';
import {VoiceCallBubble} from '../components/VoiceCallBubble';
import {BottomSheet} from '../components/BottomSheet';
import {useTheme} from '../lib/theme';

export default function VoiceCallLabPage() {
  const {t}=useI18n();
  const {resolvedTheme,setPreference}=useTheme();
  const [call,setCall]=useState<VoiceCall|null>(null);
  const [record,setRecord]=useState<VoiceCall|null>(null);
  const [folded,setFolded]=useState(false),[muted,setMuted]=useState(false),[now,setNow]=useState(Date.now());
  const [error,setError]=useState('');
  const [balance,setBalance]=useState(300);
  const elapsed=call?.connected_at?Math.min(call.max_seconds,Math.max(0,Math.floor(now/1000-call.connected_at))):0;
  const remaining=call?.deadline_at?Math.min(call.max_seconds,Math.max(0,Math.ceil(call.deadline_at-now/1000))):call?.max_seconds??0;
  const connect=()=>setCall(current=>current?{...current,state:'active',connected_at:Date.now()/1000,deadline_at:Date.now()/1000+current.max_seconds}:null);
  const end=(reason?:string)=>{
    if(!call||call.state==='ended')return;
    const used=call.connected_at?Math.min(call.max_seconds,Math.ceil(Date.now()/1000-call.connected_at)):0;
    setBalance(value=>Math.max(0,value-used));
    const ended={...call,state:'ended' as const,reason:reason??(call.connected_at?'completed':call.callee_id===1?'declined':'cancelled'),duration_seconds:used};
    setCall(ended);setRecord(ended);
  };
  const start=(mode:'ringing'|'incoming'|'active'|'low')=>{
    if(balance<=0){setError('quota_empty');return}
    const active=mode==='active'||mode==='low';
    const max=Math.min(balance,mode==='low'?15:200);
    setNow(Date.now());setMuted(false);setFolded(false);
    setCall({kind:'voice_call',call_id:crypto.randomUUID(),chat_id:0,caller_id:mode==='incoming'?2:1,callee_id:mode==='incoming'?1:2,
      state:active?'active':'ringing',reason:'',max_seconds:max,duration_seconds:0,owned:true,
      connected_at:active?Date.now()/1000:null,deadline_at:active?Date.now()/1000+max:null,
      expires_at:Date.now()/1000+30,server_now:Date.now()/1000,message_id:0,peer:{user_id:2,name:'林间'}});
  };
  useEffect(()=>{if(!call||call.state==='ended')return;const timer=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(timer)},[call?.call_id,call?.state]);
  useEffect(()=>{if(call?.state==='active'&&remaining<=0)end('quota');else if(call?.state==='ringing'&&now/1000>=call.expires_at)end('missed')},[remaining,now]);
  useEffect(()=>{
    if(call?.state!=='ringing'||call.caller_id!==1)return;
    const timer=window.setTimeout(connect,2500);return()=>window.clearTimeout(timer);
  },[call?.call_id,call?.state]);
  useEffect(()=>{const open=()=>{if(call&&call.state!=='ended')setFolded(false);else start('ringing')};window.addEventListener('frienden:voice-open',open);return()=>window.removeEventListener('frienden:voice-open',open)},[balance,call]);
  return <main className="voice-local-lab"><h1>{t('voice.lab.title')}</h1><p>{t('voice.lab.local')}</p><p>{voiceTime(balance)} / 05:00</p>
    <div className="voice-local-lab-actions"><button onClick={()=>start('ringing')}>{t('voice.lab.outgoing')}</button><button onClick={()=>start('incoming')}>{t('voice.lab.incoming')}</button><button onClick={()=>start('active')}>{t('voice.lab.active')}</button><button onClick={()=>start('low')}>{t('voice.lab.low')}</button><button onClick={()=>setError('peer_quota_empty')}>{t('voice.error.peer_quota_empty')}</button><button onClick={()=>setError('vip_required')}>{t('voice.vip')}</button><button onClick={()=>{setCall(null);setBalance(300)}}>{t('voice.lab.reset')}</button></div>
    <div className="voice-local-lab-actions"><button onClick={()=>setPreference(resolvedTheme==='dark'?'light':'dark')}>{t(resolvedTheme==='dark'?'menu.themeLight':'menu.themeDark')}</button></div>
    {record?<VoiceCallBubble call={record} incoming={record.callee_id===1}/>:null}
    {call?<VoiceCallScreen call={call} incoming={call.callee_id===1} folded={folded} muted={muted} busy={false} elapsed={elapsed} remaining={remaining} onFold={setFolded} onMute={()=>setMuted(value=>!value)} onAnswer={connect} onEnd={()=>end()} onDismiss={()=>setCall(null)}/>:null}
    <BottomSheet open={Boolean(error)} title={t('voice.title')} onClose={()=>setError('')}><p className="voice-preflight-error">{t(`voice.error.${error}`,{defaultValue:t('voice.error.network')})}</p></BottomSheet>
  </main>;
}
