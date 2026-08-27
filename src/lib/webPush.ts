import { api } from "./api";
import { i18n } from "./language";

export type WebPushState = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

const WEB_PUSH_ENDPOINT_KEY = "sermo.web-push.endpoint";
let reconciliation: Promise<void> | null = null;

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
  let registration = await navigator.serviceWorker.getRegistration();
  let subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription && Notification.permission === "granted" && window.localStorage.getItem(WEB_PUSH_ENDPOINT_KEY)) {
    await reconcileWebPushSubscription();
    registration = await navigator.serviceWorker.getRegistration();
    subscription = registration ? await registration.pushManager.getSubscription() : null;
  }
  return subscription ? "on" : "off";
}

export async function enableWebPush() {
  if (!canUseWebPush()) throw new Error(i18n.t("webPush.unsupported"));
  if (isIos() && !isStandalone()) throw new Error(i18n.t("webPush.installFirst"));
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(i18n.t("webPush.permissionDenied"));

  const info = await api.getWebPushInfo();
  if (!info.public_key) throw new Error(i18n.t("webPush.notConfigured"));
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
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
  if (reconciliation) return reconciliation;
  reconciliation = reconcileWebPushSubscriptionOnce().finally(() => {
    reconciliation = null;
  });
  return reconciliation;
}

async function reconcileWebPushSubscriptionOnce() {
  if (!canUseWebPush()) return;
  const storedEndpoint = window.localStorage.getItem(WEB_PUSH_ENDPOINT_KEY);
  let registration = await navigator.serviceWorker.getRegistration();
  let subscription = registration ? await registration.pushManager.getSubscription() : null;

  if (Notification.permission === "denied") {
    if (storedEndpoint) {
      await api.deleteWebPush(storedEndpoint);
      window.localStorage.removeItem(WEB_PUSH_ENDPOINT_KEY);
    }
    return;
  }

  // `getRegistration()` can briefly return nothing while iOS restores or
  // replaces the service worker. A transient lifecycle state must never be
  // interpreted as the user disabling notifications.
  if (Notification.permission !== "granted") return;
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      subscription = await registration.pushManager.getSubscription();
    } catch {
      return;
    }
  }

  // A stored endpoint is our durable record of explicit opt-in. Browsers may
  // rotate or discard the actual subscription after an OS/WebApp update, so
  // restore it while permission remains granted instead of switching it off.
  if (!subscription && storedEndpoint) {
    try {
      const info = await api.getWebPushInfo();
      if (!info.public_key) return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(info.public_key),
      });
    } catch {
      return;
    }
  }
  if (!subscription) return;

  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) return;
  await api.registerWebPush({
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    origin: window.location.origin,
  });
  if (storedEndpoint && storedEndpoint !== serialized.endpoint) {
    await api.deleteWebPush(storedEndpoint).catch(() => undefined);
  }
  window.localStorage.setItem(WEB_PUSH_ENDPOINT_KEY, serialized.endpoint);
}
