import {LiveTranscription,type LiveTranscript} from './liveTranscription';
import {api} from './api';
import {API_BASE_URL} from './siteConfig';

export function startChatLiveTranscription(onChange:(state:LiveTranscript)=>void,admin=false){
  const session=new LiveTranscription(onChange);
  const url=new URL(API_BASE_URL,window.location.href);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';
  url.pathname='/ws/voice-transcription';url.search='';url.hash='';
  session.connect(signal=>api.voiceStreamTicket(admin,signal),url.href);
  return session;
}
