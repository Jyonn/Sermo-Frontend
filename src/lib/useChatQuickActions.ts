import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {type ChatActionKind,type ChatQuickAction} from './chatQuickActions';
import {refreshChatShortcuts,saveChatShortcuts,shortcutSnapshot,subscribeShortcuts} from './chatQuickActionSync';

export function useChatQuickActions(scope:string,kind:ChatActionKind='group'){
  const subscribe=useCallback((listener:()=>void)=>subscribeShortcuts(scope,listener),[scope]);
  const snapshot=useCallback(()=>shortcutSnapshot(scope),[scope]);
  const value=useSyncExternalStore(subscribe,snapshot,snapshot);
  useEffect(()=>{
    const refresh=()=>{if(scope&&document.visibilityState!=='hidden')void refreshChatShortcuts(scope).catch(()=>undefined)};
    refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
  },[scope]);
  return {actions:value.preferences[kind],ready:value.revision>=0,callHintSeen:value.call_hint_seen,
    save:(actions:ChatQuickAction[])=>saveChatShortcuts(scope,{kind,actions}),
    acknowledgeCallHint:()=>saveChatShortcuts(scope,{acknowledge_call_hint:true})};
}
