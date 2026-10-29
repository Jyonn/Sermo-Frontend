import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useModalFocus } from './modalFocus';

export const MOBILE_MARKDOWN_QUERY = '(max-width: 719px), (pointer: coarse) and (max-height: 500px)';

export function useMobileMarkdownMode(enabled = true) {
  const [mobile, setMobile] = useState(() => enabled && window.matchMedia(MOBILE_MARKDOWN_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MARKDOWN_QUERY);
    const sync = () => setMobile(enabled && media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [enabled]);
  return mobile;
}

export function useMobileMarkdownEditor(root: RefObject<HTMLDivElement | null>, enabled = true, autoStart = false, onCancel?: () => void) {
  const mobile = useMobileMarkdownMode(enabled);
  const [active, setActive] = useState(() => mobile && autoStart);
  const close = useCallback(() => {
    if (root.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
    setActive(false);
  }, [root]);
  useEffect(() => { if (!mobile && active) close(); }, [mobile, active, close]);
  useModalFocus(root, active, onCancel || close, { autoFocus: false, restoreFocus: false });
  useLayoutEffect(() => {
    const node = root.current;
    if (!active || !node) return;
    const viewport = window.visualViewport;
    const sync = () => {
      node.style.setProperty('--md-viewport-height', `${viewport?.height ?? innerHeight}px`);
      node.style.setProperty('--md-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      node.style.setProperty('--md-viewport-left', `${viewport?.offsetLeft ?? 0}px`);
      node.style.setProperty('--md-viewport-width', `${viewport?.width ?? innerWidth}px`);
    };
    sync();
    // Top layer avoids transformed Drawer ancestors without remounting the input.
    const parent = node.parentNode;
    const sibling = node.nextSibling;
    const popover = typeof node.showPopover === 'function';
    if (popover) { node.setAttribute('popover', 'manual'); node.showPopover(); }
    else {
      const focused = document.activeElement as HTMLElement | null;
      const keepFocus = focused && node.contains(focused);
      document.body.appendChild(node);
      if (keepFocus) focused.focus({ preventScroll: true });
    }
    viewport?.addEventListener('resize', sync); viewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      viewport?.removeEventListener('resize', sync); viewport?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      if (popover) { if (node.matches(':popover-open')) node.hidePopover(); node.removeAttribute('popover'); }
      else if (parent) parent.insertBefore(node, sibling?.parentNode === parent ? sibling : null);
      document.documentElement.style.overflow = oldOverflow;
    };
  }, [active, root]);
  const focus = () => {
    if (mobile) setActive(true);
  };
  // Refocusing the same textarea via a tap must also work after exiting preview.
  const start = () => { if (mobile) setActive(true); };
  return { mobile, active, close, focus, start };
}
