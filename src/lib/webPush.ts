import { api } from "./api";

export type WebPushState = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

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
  if (!canUseWebPush()) throw new Error("当前浏览器不支持系统通知");
  if (isIos() && !isStandalone()) throw new Error("请先通过 Safari 添加到主屏幕");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("系统通知权限未开启");

  const info = await api.getWebPushInfo();
  if (!info.public_key) throw new Error("系统通知尚未配置");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(info.public_key),
  });
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error("无法读取浏览器通知订阅");
  }
  await api.registerWebPush({
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    origin: window.location.origin,
  });
}

export async function disableWebPush() {
  if (!canUseWebPush()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api.deleteWebPush(subscription.endpoint);
  await subscription.unsubscribe();
}
