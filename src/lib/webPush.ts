import { api } from './api';
import { i18n } from './language';
import { authStorage } from './storage';

export type WebPushState = 'checking'|'unsupported'|'needs-install'|'denied'|'off'|'on';
const DEVICE_ENDPOINT_KEY='sermo.web-push.endpoint';
const reconciliations=new Map<string,Promise<void>>();

function accountScope() {
  const user=authStorage.get()?.user;
  return user?`${user.space_id}:${user.user_id}`:null;
}
function assertAccount(scope:string|null) {
  if(!scope||accountScope()!==scope)throw new Error(i18n.t('webPush.accountChanged'));
}
function endpointKey(scope:string){return `${DEVICE_ENDPOINT_KEY}:${scope}`;}
function storedEndpoint(scope:string){return window.localStorage.getItem(endpointKey(scope))||window.localStorage.getItem(DEVICE_ENDPOINT_KEY);}
function rememberEndpoint(scope:string,endpoint:string){assertAccount(scope);window.localStorage.setItem(endpointKey(scope),endpoint);window.localStorage.setItem(DEVICE_ENDPOINT_KEY,endpoint);}
function isIos(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);}
function decodeApplicationServerKey(value:string){const raw=window.atob((value+'='.repeat((4-value.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,char=>char.charCodeAt(0));}
export function canUseWebPush(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}

async function register(scope:string,subscription:PushSubscription,restoreOnly:boolean,previousEndpoint?:string) {
  const data=subscription.toJSON();
  if(!data.endpoint||!data.keys?.p256dh||!data.keys.auth)throw new Error(i18n.t('webPush.subscriptionFailed'));
  assertAccount(scope);
  const saved=await api.registerWebPush({endpoint:data.endpoint,p256dh:data.keys.p256dh,auth:data.keys.auth,origin:window.location.origin,restore_only:restoreOnly,previous_endpoint:previousEndpoint||''});
  assertAccount(scope);
  if(saved?.opted_in!==false&&saved?.enabled)rememberEndpoint(scope,data.endpoint);
}

export async function getWebPushState(expectedScope?:string):Promise<WebPushState> {
  if(!canUseWebPush())return 'unsupported';
  if(isIos()&&!isStandalone())return 'needs-install';
  if(Notification.permission==='denied')return 'denied';
  const scope=expectedScope||accountScope();if(!scope)return 'off';assertAccount(scope);
  await reconcileWebPushSubscription();
  assertAccount(scope);
  const info=await api.getWebPushInfo();
  assertAccount(scope);
  const registration=await navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager.getSubscription();
  assertAccount(scope);
  return subscription&&info.subscriptions.some(item=>item.endpoint===subscription.endpoint&&item.enabled&&item.opted_in!==false)?'on':'off';
}

export async function enableWebPush(expectedScope?:string) {
  if(!canUseWebPush())throw new Error(i18n.t('webPush.unsupported'));
  if(isIos()&&!isStandalone())throw new Error(i18n.t('webPush.installFirst'));
  const scope=expectedScope||accountScope();assertAccount(scope);
  const permission=await Notification.requestPermission();assertAccount(scope);
  if(permission!=='granted')throw new Error(i18n.t('webPush.permissionDenied'));
  const info=await api.getWebPushInfo();assertAccount(scope);
  if(!info.public_key)throw new Error(i18n.t('webPush.notConfigured'));
  await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  const registration=await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();assertAccount(scope);
  const subscription=existing??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeApplicationServerKey(info.public_key)});
  await register(scope!,subscription,false,storedEndpoint(scope!)||undefined);
}

export async function disableWebPush(expectedScope?:string) {
  if(!canUseWebPush())return;
  const scope=expectedScope||accountScope();assertAccount(scope);
  const registration=await navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager.getSubscription();assertAccount(scope);
  const previous=storedEndpoint(scope!);
  const endpoint=subscription?.endpoint||previous;
  if(endpoint){assertAccount(scope);await api.deleteWebPush(endpoint,previous||'');}
  // Keep the shared browser subscription alive for other signed-in accounts.
}

export async function reconcileWebPushSubscription() {
  const scope=accountScope();if(!scope)return;
  const pending=reconciliations.get(scope);if(pending)return pending;
  const work=reconcile(scope).finally(()=>reconciliations.delete(scope));
  reconciliations.set(scope,work);return work;
}

async function reconcile(scope:string) {
  if(!canUseWebPush()||Notification.permission!=='granted'||(isIos()&&!isStandalone()))return;
  assertAccount(scope);
  const info=await api.getWebPushInfo();assertAccount(scope);
  const previous=storedEndpoint(scope);
  let registration=await navigator.serviceWorker.getRegistration();
  let subscription=await registration?.pushManager.getSubscription();assertAccount(scope);
  const bindings=info.bindings||info.subscriptions;
  const current=bindings.find(item=>item.endpoint===subscription?.endpoint);
  const prior=bindings.find(item=>item.endpoint===previous);
  // Browser permission and another account's endpoint are not consent for this account.
  const binding=current||prior;
  if(!binding||binding.opted_in===false)return;
  if(!registration)registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  assertAccount(scope);
  if(!subscription){
    if(!info.public_key)return;
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeApplicationServerKey(info.public_key)});
  }
  await register(scope,subscription,true,binding.endpoint);
}
