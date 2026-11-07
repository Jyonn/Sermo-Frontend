import {useLayoutEffect, type RefObject} from 'react';

/** Shared elevation for ancestor scrollers and independently scrolling tab pages. */
export function useTabHeaderSurface(ref: RefObject<HTMLElement | null>, identity = '') {
  useLayoutEffect(() => {
    const header = ref.current;
    if (!header) return;
    const scope = header.closest<HTMLElement>('.shell') ?? header.parentElement;
    let ancestor = header.parentElement;
    while (ancestor && !/auto|scroll|overlay/.test(getComputedStyle(ancestor).overflowY)) ancestor = ancestor.parentElement;
    const preferred = header.classList.contains('square-feed-header')
      ? scope?.querySelector<HTMLElement>('.square-channel-page[aria-hidden="false"]')
      : header.closest('.mobile-chat-list-screen')?.querySelector<HTMLElement>('.chat-list-screen-body');
    let scroller = preferred ?? ancestor;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.style.setProperty('--tab-sticky-elevation', String(Math.min(1, Math.max(0, (scroller?.scrollTop ?? window.scrollY) / 64))));
    };
    const scroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (!scope?.contains(target) || target.closest('.side-drawer,.bottom-sheet,.confirm-dialog') || target.closest('[aria-hidden="true"]') || target.scrollHeight <= target.clientHeight) return;
        scroller = target;
      } else if (target !== document) return;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    document.addEventListener('scroll', scroll, {capture:true, passive:true});
    return () => {document.removeEventListener('scroll', scroll, true); if (frame) cancelAnimationFrame(frame);};
  }, [ref, identity]);
}
