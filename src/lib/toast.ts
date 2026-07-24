export type ToastTone = "success" | "error" | "info";

export interface ToastDetail {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

export const APP_TOAST_EVENT = "sermo:toast";

let toastId = 0;

export function showToast(message: string, tone: ToastTone = "success", duration = tone === "error" ? 2800 : 1800) {
  if (typeof window === "undefined" || !message.trim()) return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(APP_TOAST_EVENT, {
      detail: {
        id: ++toastId,
        message: message.trim(),
        tone,
        duration,
      },
    })
  );
}
