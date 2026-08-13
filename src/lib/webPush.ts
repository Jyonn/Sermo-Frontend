import { api } from "./api";
import { i18n } from "./language";

export type WebPushState = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

const WEB_PUSH_ENDPOINT_KEY = "sermo.web-push.endpoint";
const CANONICAL_WEB_HOST = "sermo.jyonn.space";

function isLegacySpaceHost() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith(`.${CANONICAL_WEB_HOST}`) && hostname !== CANONICAL_WEB_HOST;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function canUseWebPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!canUseWebPush()) return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "off";
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

export async function enableWebPush() {
  if (!canUseWebPush()) throw new Error(i18n.t("webPush.unsupported"));
  if (isIos() && !isStandalone()) throw new Error(i18n.t("webPush.installFirst"));
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(i18n.t("webPush.permissionDenied"));

  const info = await api.getWebPushInfo();
  if (!info.public_key) throw new Error(i18n.t("webPush.notConfigured"));
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(info.public_key),
  });
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error(i18n.t("webPush.subscriptionFailed"));
  }
  await api.registerWebPush({
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    origin: window.location.origin,
  });
  window.localStorage.setItem(WEB_PUSH_ENDPOINT_KEY, serialized.endpoint);
}

export async function disableWebPush() {
  if (!canUseWebPush()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = subscription?.endpoint || window.localStorage.getItem(WEB_PUSH_ENDPOINT_KEY);
  if (endpoint) await api.deleteWebPush(endpoint);
  if (subscription) await subscription.unsubscribe();
  window.localStorage.removeItem(WEB_PUSH_ENDPOINT_KEY);
}

export async function reconcileWebPushSubscription() {
  if (!canUseWebPush()) return;
  const storedEndpoint = window.localStorage.getItem(WEB_PUSH_ENDPOINT_KEY);
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  if (isLegacySpaceHost()) {
    const endpoint = subscription?.endpoint || storedEndpoint;
    if (endpoint) await api.deleteWebPush(endpoint);
    if (subscription) await subscription.unsubscribe();
    window.localStorage.removeItem(WEB_PUSH_ENDPOINT_KEY);
    return;
  }

  if (Notification.permission !== "granted" || !subscription) {
    if (storedEndpoint) {
      await api.deleteWebPush(storedEndpoint);
      window.localStorage.removeItem(WEB_PUSH_ENDPOINT_KEY);
    }
    return;
  }

  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) return;
  await api.registerWebPush({
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    origin: window.location.origin,
  });
  window.localStorage.setItem(WEB_PUSH_ENDPOINT_KEY, serialized.endpoint);
}
