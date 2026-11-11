import {useAuth} from './auth';
import {useI18n} from './language';
import {useChatQuickActions} from './useChatQuickActions';
import {voiceCallsEnabled} from './voiceCalls';

export function useCallShortcutDiscovery(){
  const {session}=useAuth();
  const scope=session?`${session.user.space_id}:${session.user.user_id}`:'';
  const {ready,callHintSeen,acknowledgeCallHint}=useChatQuickActions(scope,'direct');
  return {pending:Boolean(scope)&&voiceCallsEnabled&&ready&&!callHintSeen,acknowledge:()=>{void acknowledgeCallHint()}};
}
export function CallShortcutDiscoveryMarker(){
  const {pending}=useCallShortcutDiscovery();const {t}=useI18n();
  return pending?<span className="update-available-dot" role="img" aria-label={t('voice.title')}/>:null;
}
