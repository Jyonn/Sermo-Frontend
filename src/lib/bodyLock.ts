import { useEffect } from "react";

let lockCount = 0;
let previousBodyOverflow = "";
let previousBodyTouchAction = "";
let previousHtmlOverflow = "";

function lockBodyScroll() {
  const body = document.body;
  const html = document.documentElement;

  if (lockCount === 0) {
    previousBodyOverflow = body.style.overflow;
    previousBodyTouchAction = body.style.touchAction;
    previousHtmlOverflow = html.style.overflow;

    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.style.overflow = "hidden";
    body.dataset.modalOpen = "true";
  }

  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;

    body.style.overflow = previousBodyOverflow;
    body.style.touchAction = previousBodyTouchAction;
    html.style.overflow = previousHtmlOverflow;
    delete body.dataset.modalOpen;
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
