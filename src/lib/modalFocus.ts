import { useEffect, useRef, type RefObject } from "react";

const layers: symbol[] = [];
const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function useModalFocus(root: RefObject<HTMLElement | null>, open: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    if (!open) return;
    const token = Symbol();
    const previous = document.activeElement as HTMLElement | null;
    layers.push(token);
    const targets = () => Array.from(root.current?.querySelectorAll<HTMLElement>(focusable) ?? []).filter((node) => node.getClientRects().length > 0 && !node.closest('[aria-hidden="true"],[inert]') && (typeof node.checkVisibility !== "function" || node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
    const frame = requestAnimationFrame(() => (targets()[0] ?? root.current)?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (layers[layers.length - 1] !== token || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); escape.current?.();
      }
      if (event.key === "Tab") {
        const nodes = targets();
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); root.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown, true);
      const top = layers[layers.length - 1] === token;
      layers.splice(layers.indexOf(token), 1);
      if (top && previous?.isConnected) previous.focus();
    };
  }, [open, root]);
}
