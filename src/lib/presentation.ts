import { getActiveLanguage } from "./language";

export function formatRelativeTime(timestampSeconds: number) {
  const deltaMinutes = Math.max(1, Math.floor((Date.now() / 1000 - timestampSeconds) / 60));

  if (getActiveLanguage() === "en") {
    if (deltaMinutes < 60) return deltaMinutes <= 1 ? "Just now" : `${deltaMinutes} min ago`;
    if (deltaMinutes < 1440) return `${Math.floor(deltaMinutes / 60)} hr ago`;
    return `${Math.floor(deltaMinutes / 1440)} d ago`;
  }
  if (deltaMinutes < 60) return deltaMinutes <= 1 ? "刚刚" : `${deltaMinutes} 分钟前`;
  if (deltaMinutes < 1440) return `${Math.floor(deltaMinutes / 60)} 小时前`;
  return `${Math.floor(deltaMinutes / 1440)} 天前`;
}

export async function copyText(value: string) {
  const text = value.trim();
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below for browsers that block Clipboard API in current context.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) selection.addRange(previousRange);
    }
  }

  return copied;
}
